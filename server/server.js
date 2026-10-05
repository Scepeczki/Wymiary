// Wymiary — the game's local server and the network game server in one (no npm packages needed).
//   node server/server.js --app [--port 47816]     started (hidden) by the Wymiary shortcut (launcher/play.ps1)
//   node server/server.js [--port 8080] [--open]   a plain / dedicated network game server (also used by the tests)
// App mode: serves the game to its own window on 127.0.0.1 only (always the same address, so the browser keeps the
// settings, and WebHID works there). From the menu the game can
//   * host a network game: POST /api/host opens a second listener on 0.0.0.0:8080 for the other players,
//   * join someone: GET /api/remote?addr= checks the other server's version (the page then connects its WebSocket
//     straight to ws://<addr>/ws),
//   * update itself: POST /api/update runs launcher/update.ps1 -Restart.
// The window keeps a WebSocket at /ctl open; when it is gone for a few seconds (window closed) the server quits.
// Players: a WebSocket at /ws. Each player gets an id and a team (A / B alternately); every message from a player is
// forwarded to the others with `from` set to the sender's id.
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto'), os = require('os'), cp = require('child_process');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const APP = args.includes('--app');
const PORT = +(args[args.indexOf('--port') + 1] || 0) || (APP ? 47816 : 8080);
const HOST_PORT = 8080;                     // where other players connect when you host from the game
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.css': 'text/css', '.json': 'application/json' };

// ---------------- the game's files (what the server offers; also what a release contains) ----------------
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
// version = date of the newest file + a hash of all files; `hash` alone tells whether two copies are the same game
function manifest() {
  const files = distFiles().map(p => {
    const data = fs.readFileSync(path.join(ROOT, p));
    return { p, sha: crypto.createHash('sha256').update(data).digest('hex'), size: data.length };
  });
  const hash = crypto.createHash('sha256').update(files.map(f => f.p + ':' + f.sha).sort().join('\n')).digest('hex').slice(0, 6);
  const newest = Math.max(...files.map(f => fs.statSync(path.join(ROOT, f.p)).mtimeMs));
  const d = new Date(newest), pad = n => String(n).padStart(2, '0');
  let release = '';
  try { release = fs.readFileSync(path.join(ROOT, 'version.txt'), 'utf8').trim(); } catch (e) { /* a copy from the repository */ }
  return { version: `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}-${hash}`, hash, release, files };
}
if (args.includes('--manifest')) { process.stdout.write(JSON.stringify(manifest())); process.exit(0); }
let manifestCache = null, manifestT = 0;
const info = () => { if (Date.now() - manifestT > 5000) { manifestCache = manifest(); manifestT = Date.now(); } return manifestCache; };

function lanAddresses(port) {
  const ts = ip => /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(ip);   // Tailscale range 100.64.0.0/10
  return Object.values(os.networkInterfaces()).flat()
    .filter(i => i && i.family === 'IPv4' && !i.internal && !i.address.startsWith('169.254.'))
    .map(i => ({ addr: i.address + ':' + port, tailscale: ts(i.address) }));
}
const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }); res.end(JSON.stringify(obj)); };

// ---------------- HTTP ----------------
// own = the request came through the game's own listener (127.0.0.1 in app mode): only there the game may control
// the server. The X-Wymiary header keeps other web pages out (a custom header needs a CORS preflight we never allow).
function handle(req, res, own) {
  const u = new URL(req.url, 'http://x');
  let p = decodeURIComponent(u.pathname);
  if (p === '/api/manifest') {
    res.setHeader('Access-Control-Allow-Origin', '*');   // public: a game opened from disk may check the version
    return json(res, 200, info());
  }
  if (p.startsWith('/api/')) {
    if (!own || !APP || req.headers['x-wymiary'] !== '1') return json(res, 403, { error: 'forbidden' });
    if (p === '/api/app') return json(res, 200, { app: true, version: info().version, hash: info().hash, release: info().release, host: hostInfo() });
    if (p === '/api/host' && req.method === 'POST') return startHosting(res);
    if (p === '/api/host/stop' && req.method === 'POST') { stopHosting(); return json(res, 200, { ok: true }); }
    if (p === '/api/remote') return checkRemote(u.searchParams.get('addr') || '', res);
    if (p === '/api/update' && req.method === 'POST') return runUpdate(res);
    if (p === '/api/settings') return settings(req, res);
    return json(res, 404, { error: 'unknown' });
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
}

// ---------------- hosting from the game (app mode) ----------------
let lan = null;                              // the listener for other players: http.Server on 0.0.0.0:HOST_PORT
const hostInfo = () => (lan && lan.listening ? { port: HOST_PORT, addrs: lanAddresses(HOST_PORT) } : null);
function startHosting(res) {
  if (hostInfo()) return json(res, 200, { ok: true, host: hostInfo() });
  lan = http.createServer((req, r) => handle(req, r, false));
  lan.on('upgrade', (req, socket) => upgrade(req, socket, false));
  lan.once('error', e => {
    lan = null;
    json(res, 200, { ok: false, error: e.code === 'EADDRINUSE' ? `Port ${HOST_PORT} jest zajęty (może działa już inny serwer gry?).` : e.message });
  });
  lan.listen(HOST_PORT, '0.0.0.0', () => {
    log(`hostowanie: inni gracze łączą się na ${lanAddresses(HOST_PORT).map(a => a.addr).join(', ')}`);
    json(res, 200, { ok: true, host: hostInfo() });
  });
}
function stopHosting() {
  if (!lan) return;
  lan.close();
  for (const [s, c] of clients) if (c.lan) s.destroy();     // players from the network: disconnected
  lan = null;
  log('hostowanie zakończone');
}
// the version of another player's server (fetched here: the page would need CORS for it)
function checkRemote(addr, res) {
  addr = addr.trim().replace(/^\w+:\/\//, '').replace(/\/.*$/, '');
  if (!/^[\w.-]+(:\d+)?$/.test(addr)) return json(res, 200, { ok: false, error: 'Niepoprawny adres.' });
  if (!/:\d+$/.test(addr)) addr += ':' + HOST_PORT;
  const req = http.get(`http://${addr}/api/manifest`, { timeout: 4000 }, r => {
    let body = '';
    r.on('data', c => { body += c; });
    r.on('end', () => {
      try {
        const m = JSON.parse(body), mine = info();
        json(res, 200, { ok: true, addr, version: m.version, release: m.release || '', same: m.hash ? m.hash === mine.hash : m.version.split('-')[1] === mine.hash,
          mine: mine.version, mineRelease: mine.release });
      } catch (e) { json(res, 200, { ok: false, addr, error: 'Pod tym adresem nie ma serwera gry Wymiary.' }); }
    });
  });
  req.on('timeout', () => req.destroy(new Error('timeout')));
  req.on('error', () => json(res, 200, { ok: false, addr, error: `Brak połączenia z ${addr}. Czy tamten gracz kliknął „Hostuj grę”? Czy jesteście w tej samej sieci (albo w Tailscale)?` }));
}
// the player's settings (js/store.js): one JSON file of the Windows user, outside the game folder — it survives
// updates, reinstalling and a reset browser profile
const SETTINGS = path.join(process.env.LOCALAPPDATA || os.homedir(), 'Wymiary', 'settings.json');
function settings(req, res) {
  if (req.method !== 'POST') {
    let data = {};
    try { data = JSON.parse(fs.readFileSync(SETTINGS, 'utf8')); } catch (e) { /* none yet */ }
    return json(res, 200, data);
  }
  let body = '';
  req.on('data', c => { body += c; if (body.length > 2e6) req.destroy(); });
  req.on('end', () => {
    let data;
    try { data = JSON.parse(body); } catch (e) { return json(res, 400, { error: 'bad json' }); }
    if (!data || typeof data !== 'object' || Array.isArray(data)) return json(res, 400, { error: 'bad data' });
    const clean = {};
    for (const [k, v] of Object.entries(data)) if (/^wymiary\.[\w.-]+$/.test(k) && typeof v === 'string') clean[k] = v;
    try {
      fs.mkdirSync(path.dirname(SETTINGS), { recursive: true });
      fs.writeFileSync(SETTINGS + '.tmp', JSON.stringify(clean, null, 1));
      fs.renameSync(SETTINGS + '.tmp', SETTINGS);                 // never a half-written file
      json(res, 200, { ok: true });
    } catch (e) { json(res, 500, { error: e.message }); }
  });
}
function runUpdate(res) {
  const ps1 = path.join(ROOT, 'launcher', 'update.ps1');
  if (!fs.existsSync(path.join(ROOT, 'version.txt'))) return json(res, 200, { ok: false, error: 'To kopia z repozytorium, nie instalacja — aktualizacji nie ma.' });
  const ps = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  cp.spawn(ps, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', ps1, '-Restart'], { detached: true, stdio: 'ignore' }).unref();
  json(res, 200, { ok: true });
}

// ---------------- minimal WebSocket (RFC 6455) ----------------
const clients = new Map();   // socket -> { id, team, buf, lan }
let nextId = 1, ctl = 0, quitT = null;
function handshake(req, socket) {
  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.destroy(); return false; }
  const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  socket.setNoDelay(true);
  return true;
}
// frames of one socket: onText(string) for text, close / ping handled here
function frames(socket, onText) {
  let buf = Buffer.alloc(0);
  socket.on('data', chunk => {
    buf = Buffer.concat([buf, chunk]);
    for (;;) {
      const f = parseFrame(buf);
      if (!f) break;
      buf = buf.slice(f.size);
      if (f.op === 8) return socket.end();                                   // close
      if (f.op === 9) { socket.write(frame(f.data, 10)); continue; }         // ping -> pong
      if (f.op === 1) onText(f.data.toString('utf8'));
    }
  });
}
function upgrade(req, socket, own) {
  const p = new URL(req.url, 'http://x').pathname;
  if (p === '/ctl' && own && APP) return control(req, socket);
  if (p !== '/ws' || !handshake(req, socket)) return socket.destroy();
  const teams = [...clients.values()].map(c => c.team);
  const team = teams.filter(t => t === 'A').length <= teams.filter(t => t === 'B').length ? 'A' : 'B';
  const me = { id: nextId++, team, lan: !own };
  const peers = [...clients.values()].map(c => ({ id: c.id, team: c.team }));
  clients.set(socket, me);
  send(socket, { t: 'welcome', id: me.id, team, peers });
  broadcast(socket, { t: 'join', id: me.id, team });
  log(`gracz ${me.id} dołączył (drużyna ${team}) z ${socket.remoteAddress} — graczy: ${clients.size}`);
  frames(socket, text => {
    let m; try { m = JSON.parse(text); } catch (e) { return; }
    m.from = me.id;
    broadcast(socket, m);
  });
  const gone = () => {
    if (!clients.has(socket)) return;
    clients.delete(socket);
    broadcast(socket, { t: 'leave', id: me.id });
    log(`gracz ${me.id} wyszedł — graczy: ${clients.size}`);
  };
  socket.on('close', gone); socket.on('error', gone);
}
// the game window's lifeline (app mode): the server quits a few seconds after the last window is gone
function control(req, socket) {
  if (!handshake(req, socket)) return;
  ctl++; clearTimeout(quitT);
  frames(socket, () => {});
  let done = false;
  const gone = () => {
    if (done) return;
    done = true;
    if (--ctl <= 0) quitT = setTimeout(() => { log('okno gry zamknięte — koniec'); process.exit(0); }, 6000);
  };
  socket.on('close', gone); socket.on('error', gone);
}
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

// ---------------- start ----------------
const server = http.createServer((req, res) => handle(req, res, true));
server.on('upgrade', (req, socket) => upgrade(req, socket, true));
server.on('error', e => {
  console.error('Nie mogę uruchomić serwera:', e.message);
  if (e.code === 'EADDRINUSE') console.error(`Port ${PORT} jest zajęty — może serwer już działa?`);
  process.exit(1);
});
if (APP) {
  server.listen(PORT, '127.0.0.1', () => log(`Wymiary: http://localhost:${PORT}/  (wersja ${info().version})`));
  // "localhost" may resolve to ::1 first: answer there too (without IPv6 this just fails quietly)
  const v6 = http.createServer((req, res) => handle(req, res, true));
  v6.on('upgrade', (req, socket) => upgrade(req, socket, true));
  v6.on('error', () => {});
  v6.listen(PORT, '::1');
  // nobody opened the window (browser missing?): do not linger
  setTimeout(() => { if (!ctl) { log('okno gry się nie połączyło — koniec'); process.exit(0); } }, 90000);
} else {
  server.listen(PORT, '0.0.0.0', () => {
    console.log('\n  WYMIARY — serwer gry sieciowej działa\n');
    console.log(`  Wersja gry: ${info().version}\n`);
    console.log('  Adres dla graczy (w grze: menu → 🌐 Gra sieciowa → Dołącz):');
    for (const a of lanAddresses(PORT)) console.log(`     ${a.addr.padEnd(22)} ${a.tailscale ? 'przez Tailscale — z dowolnego miejsca' : 'ta sama sieć Wi-Fi / LAN'}`);
    console.log('\n  Bez zainstalowanej gry wystarczy otworzyć w przeglądarce: http://<adres>/');
    console.log('  Jeśli Windows zapyta o zaporę — zezwól na dostęp w sieciach prywatnych.');
    console.log('  Zamknij to okno, żeby wyłączyć serwer.\n');
    if (args.includes('--open')) openBrowser(`http://localhost:${PORT}/`);
  });
}

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
