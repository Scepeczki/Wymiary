// Usage: node tools/dev/mptest.js <outdir> [map] [mode] [posA] [posB] [turnB] [extra query]
// End-to-end multiplayer test on this PC: starts the game server, opens two game windows (off-screen) on the same
// map and mode, places them facing each other and saves a screenshot from each one (mp1.png, mp2.png).
// Default: the loop arena, network game.  e.g. 4D:  node tools/dev/mptest.js out 2 0 0,1.6,-3,0 0.4,1.6,3,0 3.1416
const http = require('http'), fs = require('fs'), path = require('path'), cp = require('child_process');
const out = process.argv[2] || '.', brave = 'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe';
const root = path.join(__dirname, '..', '..');
const srv = cp.spawn(process.execPath, [path.join(root, 'server', 'server.js'), '--port', '8098'], { stdio: 'inherit' });
const procs = [];
let saved = 0;
const recv = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.end();   // CORS preflight (the page is served from another port)
  const u = new URL(req.url, 'http://x'), chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', () => {
    fs.writeFileSync(path.join(out, u.searchParams.get('n') + '.png'), Buffer.concat(chunks));
    console.log('saved', u.searchParams.get('n'), u.searchParams.get('stats') || '');
    res.end('ok');
    if (++saved === 2) finish();
  });
}).listen(8766, () => {
  // client 1 stands at z=-24 looking north, client 2 at z=-14 looking south (middle corridor / hall door)
  const shot = n => encodeURIComponent(`http://localhost:8766/shot?n=${n}`);
  const [, , , map = '10', mode = '3', posA = '0,1.6,-26', posB = '0.5,1.6,-18', turnB = '3.1416', extra = '', extraB = ''] = process.argv;
  const pa = posA === '-' ? '' : `&posf=300&pos=${posA}`, pb = posB === '-' ? '' : `&posf=300&pos=${posB}`;
  const urls = [
    `http://localhost:8098/index.html?w=${map}&mode=${mode}&frames=420${pa}&${extra}&shot=${shot('mp1')}`,
    `http://localhost:8098/index.html?w=${map}&mode=${mode}&frames=420${pb}&turn=${turnB}&${extra}&${extraB}&shot=${shot('mp2')}`,
  ];
  urls.forEach((url, i) => setTimeout(() => procs.push(cp.spawn(brave, [`--app=${url}`, `--user-data-dir=${process.env.TEMP}\\wymiary-mp${i}`,
    `--window-position=${-3000 - i * 1400},0`, '--window-size=1280,720', '--no-first-run', '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding', '--disable-background-timer-throttling'], { stdio: 'ignore' })), 800 + i * 400));
});
function finish() {
  for (const p of procs) try { cp.execSync(`taskkill /PID ${p.pid} /T /F`, { stdio: 'ignore' }); } catch (e) { /* ignore */ }
  srv.kill(); recv.close();
  setTimeout(() => process.exit(0), 300);
}
setTimeout(() => { console.log('timeout'); finish(); }, 120000);
