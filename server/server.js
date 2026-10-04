// Wymiary — game server for playing over the local network (no npm packages needed).
//   node server/server.js [--port 8080] [--open]
// Serves the game over HTTP and relays messages between players over a WebSocket at /ws.
// Each player gets an id and a team (A / B alternately); every message from a player is forwarded to the others
// with `from` set to the sender's id.
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto'), os = require('os'), cp = require('child_process');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const PORT = +(args[args.indexOf('--port') + 1] || 0) || 8080;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.ico': 'image/x-icon', '.css': 'text/css', '.json': 'application/json' };

// ---------------- distribution: the files a player's copy of the game consists of ----------------
// Other players' launchers fetch /api/manifest and download the files whose hash differs — so whatever version
// runs on the host is the version everybody gets (this is how updates reach other computers).
const DIST = ['index.html', 'README.md', 'Zainstaluj.cmd', 'assets', 'js', 'server', 'launcher', 'installer'];
function distFiles() {
  const out = [];
  const walk = rel => {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) return;
    if (fs.statSync(abs).isDirectory()) { for (const f of fs.readdirSync(abs).sort()) walk(rel + '/' + f); }
    else out.push(rel);
  };
  DIST.forEach(walk);
  return out.filter(f => !/\.(lnk|log|tmp)$/i.test(f));
}
function manifest() {
  const files = distFiles().map(p => {
    const data = fs.readFileSync(path.join(ROOT, p));
    return { p, sha: crypto.createHash('sha256').update(data).digest('hex'), size: data.length };
  });
  const lines = files.map(f => f.p + ':' + f.sha).sort().join('\n');
  const newest = Math.max(...distFiles().map(p => fs.statSync(path.join(ROOT, p)).mtimeMs));
  const d = new Date(newest), pad = n => String(n).padStart(2, '0');
  const version = `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}-${crypto.createHash('sha256').update(lines).digest('hex').slice(0, 6)}`;
  return { version, files };
}
if (args.includes('--manifest')) { process.stdout.write(JSON.stringify(manifest())); process.exit(0); }

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/api/manifest') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
    return res.end(JSON.stringify(manifest()));
  }
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(ROOT, p));
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  // only the distributed files are served (never tools/, .git, or anything outside the game folder)
  if (rel.startsWith('..') || !DIST.some(d => rel === d || rel.startsWith(d + '/'))) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

// ---------------- minimal WebSocket (RFC 6455) ----------------
const clients = new Map();   // socket -> { id, team, buf }
let nextId = 1;
server.on('upgrade', (req, socket) => {
  if (new URL(req.url, 'http://x').pathname !== '/ws') return socket.destroy();
  const key = req.headers['sec-websocket-key'];
  const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  socket.setNoDelay(true);
  const teams = [...clients.values()].map(c => c.team);
  const team = teams.filter(t => t === 'A').length <= teams.filter(t => t === 'B').length ? 'A' : 'B';
  const me = { id: nextId++, team, buf: Buffer.alloc(0) };
  const peers = [...clients.values()].map(c => ({ id: c.id, team: c.team }));
  clients.set(socket, me);
  send(socket, { t: 'welcome', id: me.id, team, peers });
  broadcast(socket, { t: 'join', id: me.id, team });
  log(`gracz ${me.id} dołączył (drużyna ${team}) z ${socket.remoteAddress} — graczy: ${clients.size}`);

  socket.on('data', chunk => {
    me.buf = Buffer.concat([me.buf, chunk]);
    for (;;) {
      const f = parseFrame(me.buf);
      if (!f) break;
      me.buf = me.buf.slice(f.size);
      if (f.op === 8) return socket.end();                                   // close
      if (f.op === 9) { socket.write(frame(f.data, 10)); continue; }         // ping -> pong
      if (f.op !== 1) continue;
      let m; try { m = JSON.parse(f.data.toString('utf8')); } catch (e) { continue; }
      m.from = me.id;
      broadcast(socket, m);
    }
  });
  const gone = () => {
    if (!clients.has(socket)) return;
    clients.delete(socket);
    broadcast(socket, { t: 'leave', id: me.id });
    log(`gracz ${me.id} wyszedł — graczy: ${clients.size}`);
  };
  socket.on('close', gone); socket.on('error', gone);
});
function parseFrame(b) {
  if (b.length < 2) return null;
  const op = b[0] & 15, masked = b[1] & 128;
  let len = b[1] & 127, o = 2;
  if (len === 126) { if (b.length < 4) return null; len = b.readUInt16BE(2); o = 4; }
  else if (len === 127) { if (b.length < 10) return null; len = Number(b.readBigUInt64BE(2)); o = 10; }
  const mask = masked ? b.slice(o, o + 4) : null;
  if (masked) o += 4;
  if (b.length < o + len) return null;
  const data = Buffer.from(b.slice(o, o + len));
  if (mask) for (let i = 0; i < data.length; i++) data[i] ^= mask[i & 3];
  return { op, data, size: o + len };
}
function frame(data, op = 1) {
  const len = data.length, head = len < 126 ? Buffer.from([128 | op, len]) : len < 65536 ? Buffer.from([128 | op, 126, len >> 8, len & 255]) : null;
  if (head) return Buffer.concat([head, data]);
  const h = Buffer.alloc(10); h[0] = 128 | op; h[1] = 127; h.writeBigUInt64BE(BigInt(len), 2);
  return Buffer.concat([h, data]);
}
function send(socket, m) { try { socket.write(frame(Buffer.from(JSON.stringify(m)))); } catch (e) { /* ignore */ } }
function broadcast(from, m) { for (const s of clients.keys()) if (s !== from) send(s, m); }
function log(s) { console.log(new Date().toLocaleTimeString() + '  ' + s); }

server.listen(PORT, '0.0.0.0', () => {
  const ips = Object.values(os.networkInterfaces()).flat().filter(i => i && i.family === 'IPv4' && !i.internal && !i.address.startsWith('169.254.')).map(i => i.address);
  const q = '/?w=7&mode=3';
  console.log('\n  WYMIARY — serwer gry sieciowej działa\n');
  console.log(`  Ty (na tym komputerze):   http://localhost:${PORT}${q}`);
  const ts = ip => /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(ip);   // Tailscale range 100.64.0.0/10
  console.log(`  Wersja gry: ${manifest().version}\n`);
  console.log('  Adres dla drugiego gracza (wpisuje go w „Wymiary – dołącz do gry”):');
  for (const ip of ips) console.log(`     ${(ip + ':' + PORT).padEnd(22)} ${ts(ip) ? 'przez Tailscale — z dowolnego miejsca' : 'ta sama sieć Wi-Fi / LAN'}`);
  console.log('\n  Bez zainstalowanej gry wystarczy otworzyć w przeglądarce: http://<adres>' + q);
  console.log('  Jeśli Windows zapyta o zaporę — zezwól na dostęp w sieciach prywatnych.');
  console.log('  Zamknij to okno, żeby wyłączyć serwer.\n');
  if (args.includes('--open')) openBrowser(`http://localhost:${PORT}${q}`);
});
server.on('error', e => { console.error('Nie mogę uruchomić serwera:', e.message); if (e.code === 'EADDRINUSE') console.error(`Port ${PORT} jest zajęty — może serwer już działa?`); });

function openBrowser(url) {
  const env = process.env, cands = [
    path.join(env.ProgramFiles || '', 'BraveSoftware/Brave-Browser/Application/brave.exe'),
    path.join(env.LOCALAPPDATA || '', 'BraveSoftware/Brave-Browser/Application/brave.exe'),
    path.join(env.ProgramFiles || '', 'Google/Chrome/Application/chrome.exe'),
    path.join(env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
    path.join(env['ProgramFiles(x86)'] || '', 'Microsoft/Edge/Application/msedge.exe'),
  ];
  const b = cands.find(f => f && fs.existsSync(f));
  const profile = path.join(env.LOCALAPPDATA || os.tmpdir(), 'Wymiary', 'browser-profile');
  if (b) cp.spawn(b, [`--app=${url}`, `--user-data-dir=${profile}`, '--start-maximized', '--no-first-run'], { detached: true, stdio: 'ignore' }).unref();
  else cp.exec(`start "" "${url}"`);
}
