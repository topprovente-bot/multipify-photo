'use strict';
/* Serveur de session en direct Multipify Photo (WebSocket minimal, sans dépendance).
   Relaie les messages entre les participants d'une même session sur le réseau local. */
const http = require('http');
const crypto = require('crypto');

function encode(str) {
  const p = Buffer.from(str, 'utf8'), n = p.length;
  const h = n < 126 ? Buffer.from([0x81, n]) : n < 65536 ? Buffer.from([0x81, 126, n >> 8, n & 255]) : (() => { const b = Buffer.alloc(10); b[0] = 0x81; b[1] = 127; b.writeBigUInt64BE(BigInt(n), 2); return b; })();
  return Buffer.concat([h, p]);
}

function start({ port = 41700, code, relay = false, maxPayload = 256 * 1024 * 1024 } = {}) {
  const rooms = new Map(); let seq = 0;
  const roomOf = (req) => { const u = new URL(req.url, 'http://x'), m = u.pathname.match(/^\/r\/([A-Za-z0-9_-]{3,40})$/); return { name: m ? m[1] : 'default', code: u.searchParams.get('code') || '' }; };
  const server = http.createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Multipify Photo — session en direct'); });
  const send = (c, obj) => { try { c.sock.write(encode(typeof obj === 'string' ? obj : JSON.stringify(obj))); } catch (_) { /* */ } };
  server.on('upgrade', (req, sock) => {
    const key = req.headers['sec-websocket-key'], R = roomOf(req);
    if (!key) { sock.end('HTTP/1.1 400 Bad Request\r\n\r\n'); return; }
    let room = rooms.get(R.name);
    if (R.name === 'default' && !relay) { if (code && R.code !== String(code)) { sock.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return; } }
    else if (R.name === 'default' && relay) { sock.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return; }
    if (room && room.code !== R.code && !(R.name === 'default' && !relay)) { sock.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return; }
    if (!room) { if (rooms.size > 500) { sock.end('HTTP/1.1 503 Service Unavailable\r\n\r\n'); return; } if (R.name !== 'default' && R.code.length < 4) { sock.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return; } room = { code: R.code, clients: new Map() }; rooms.set(R.name, room); }
    const clients = room.clients;
    const broadcast = (from, raw) => { for (const c of clients.values()) if (c !== from && c.ready) try { c.sock.write(encode(raw)); } catch (_) { /* */ } };
    const roster = () => [...clients.values()].filter((c) => c.ready).map((c) => ({ id: c.id, name: c.name, color: c.color, host: c.host }));
    const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
    sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
    sock.setNoDelay(true);
    const c = { id: 'p' + (++seq), sock, buf: Buffer.alloc(0), frag: [], ready: false, name: '?', color: '#4f7cff', host: false }; clients.set(c.id, c);
    const onMessage = (txt) => {
      let m; try { m = JSON.parse(txt); } catch (_) { return; }
      if (m.t === 'hello') { c.name = String(m.name || 'Invité').slice(0, 40); c.color = m.color || c.color; c.host = !!m.host && ![...clients.values()].some((o) => o.host && o !== c); c.ready = true; send(c, { t: 'welcome', id: c.id, host: c.host, roster: roster() }); broadcast(c, JSON.stringify({ t: 'roster', roster: roster(), joined: c.id })); return; }
      if (!c.ready) return;
      m.from = c.id; m.name = c.name; m.color = c.color;
      const raw = JSON.stringify(m);
      if (m.to) { const d = clients.get(m.to); if (d) try { d.sock.write(encode(raw)); } catch (_) { /* */ } } else broadcast(c, raw);
    };
    sock.on('data', (chunk) => {
      c.buf = Buffer.concat([c.buf, chunk]);
      for (;;) {
        if (c.buf.length < 2) return; const b0 = c.buf[0], b1 = c.buf[1], op = b0 & 15, fin = b0 & 0x80, masked = b1 & 0x80; let len = b1 & 127, o = 2;
        if (len === 126) { if (c.buf.length < 4) return; len = c.buf.readUInt16BE(2); o = 4; } else if (len === 127) { if (c.buf.length < 10) return; len = Number(c.buf.readBigUInt64BE(2)); o = 10; }
        if (len > maxPayload) { sock.destroy(); return; }
        const mk = masked ? 4 : 0; if (c.buf.length < o + mk + len) return;
        let data = c.buf.subarray(o + mk, o + mk + len); if (masked) { const m = c.buf.subarray(o, o + 4); data = Buffer.from(data); for (let i = 0; i < data.length; i++) data[i] ^= m[i & 3]; }
        c.buf = c.buf.subarray(o + mk + len);
        if (op === 8) { sock.end(); return; }
        if (op === 9) { sock.write(Buffer.concat([Buffer.from([0x8a, data.length]), data])); continue; }
        if (op === 10) continue;
        if (op === 1 || op === 2 || op === 0) { c.frag.push(data); if (fin) { const t = Buffer.concat(c.frag).toString('utf8'); c.frag = []; onMessage(t); } }
      }
    });
    const ping = setInterval(() => { try { sock.write(Buffer.from([0x89, 0])); } catch (_) { /* */ } }, 25000);
    const bye = () => { clearInterval(ping); if (!clients.has(c.id)) return; clients.delete(c.id); for (const o of clients.values()) if (o.ready) send(o, { t: 'roster', roster: roster(), left: c.id }); if (!clients.size) rooms.delete(R.name); };
    sock.on('close', bye); sock.on('error', bye);
  });
  return new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '0.0.0.0', () => resolve({ server, port: server.address().port, close: () => { for (const r of rooms.values()) for (const c of r.clients.values()) c.sock.destroy(); server.close(); } })); });
}
module.exports = { start };
if (require.main === module) { const relay = process.argv.includes('--relay'), args = process.argv.slice(2).filter((a) => a !== '--relay'); start({ port: +args[0] || +process.env.PORT || 41700, code: args[1], relay }).then((s) => console.log((relay ? 'Relais Multipify Photo' : 'Session en direct') + ' sur le port ' + s.port)); }
