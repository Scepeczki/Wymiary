// Serves the game over http and receives canvas screenshots. Usage: node shotserver.js <outdir> <spec...>
// spec = name:query  e.g. hub:w=1   -> opens ?w=1&shot=... and saves <outdir>/hub.png
// extra query params: proj=M turn=RAD pitch=RAD walk=1 frames=N defs=A,B (GLSL #defines)
const http = require('http'), fs = require('fs'), path = require('path'), cp = require('child_process');
const root = path.join(__dirname, '..', '..'), out = process.argv[2], specs = process.argv.slice(3);
const brave = 'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.ico': 'image/x-icon' };
let proc, idx = 0, timer;
const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (req.method === 'POST' && u.pathname === '/shot') {
    const chunks = []; req.on('data', c => chunks.push(c));
    req.on('end', () => { fs.writeFileSync(path.join(out, u.searchParams.get('n') + '.png'), Buffer.concat(chunks)); res.end('ok'); console.log('saved', u.searchParams.get('n'), u.searchParams.get('stats') || ''); next(); });
    return;
  }
  const f = path.join(root, decodeURIComponent(u.pathname));
  fs.readFile(f, (e, d) => { if (e) { res.statusCode = 404; return res.end(); } res.setHeader('Content-Type', types[path.extname(f)] || 'text/plain'); res.end(d); });
});
function kill() { if (proc) { try { cp.execSync(`taskkill /PID ${proc.pid} /T /F`, { stdio: 'ignore' }); } catch (e) {} proc = null; } }
function next() {
  clearTimeout(timer); kill();
  if (idx >= specs.length) { srv.close(); return; }
  const [name, query] = specs[idx++].split(':');
  const url = `http://localhost:8765/index.html?${query}&shot=${encodeURIComponent('http://localhost:8765/shot?n=' + name)}`;
  proc = cp.spawn(brave, [`--app=${url}`, `--user-data-dir=${process.env.TEMP}\wymiary-test-profile`, '--window-position=-3000,0', '--window-size=1280,720',
    '--no-first-run', '--ignore-gpu-blocklist', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'], { stdio: 'ignore' });
  timer = setTimeout(() => { console.log('timeout', name); next(); }, +(process.env.SHOT_TIMEOUT || 40000));
}
srv.listen(8765, next);
