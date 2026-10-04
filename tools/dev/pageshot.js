// Screenshot of the whole page (HTML overlays included, unlike shotserver.js which grabs only the canvas), through the
// DevTools protocol of an off-screen Brave window. Usage:
//   node tools/dev/pageshot.js <out.png> [query] [waitSeconds] [js to run before the capture]
const http = require('http'), fs = require('fs'), path = require('path'), cp = require('child_process');
const root = path.join(__dirname, '..', '..');
const [out, query = '', wait = '8', js = ''] = process.argv.slice(2);
const brave = 'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' };
const srv = http.createServer((req, res) => {
  const f = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  fs.readFile(f, (e, d) => { if (e) { res.statusCode = 404; return res.end(); } res.setHeader('Content-Type', types[path.extname(f)] || 'text/plain'); res.end(d); });
}).listen(8766);
const proc = cp.spawn(brave, [`--app=http://localhost:8766/index.html?${query}`, `--user-data-dir=${process.env.TEMP}\\wymiary-pageshot-profile`,
  '--remote-debugging-port=9334', '--window-position=-3000,0', '--window-size=1600,900', '--no-first-run', '--ignore-gpu-blocklist',
  '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'], { stdio: 'ignore' });
const done = code => { try { cp.execSync(`taskkill /PID ${proc.pid} /T /F`, { stdio: 'ignore' }); } catch (e) {} srv.close(); process.exit(code); };
setTimeout(async () => {
  try {
    const list = await (await fetch('http://localhost:9334/json')).json();
    const page = list.find(t => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    let id = 0; const wait4 = {};
    ws.onmessage = e => { const m = JSON.parse(e.data); if (wait4[m.id]) wait4[m.id](m); };
    const send = (method, params = {}) => new Promise(r => { wait4[++id] = r; ws.send(JSON.stringify({ id, method, params })); });
    await new Promise(r => { ws.onopen = r; });
    if (js) { const r = await send('Runtime.evaluate', { expression: js, awaitPromise: true, returnByValue: true }); if (r.result && r.result.exceptionDetails) console.log('JS:', JSON.stringify(r.result.exceptionDetails)); else if (r.result && r.result.result.value !== undefined) console.log('JS =>', JSON.stringify(r.result.result.value)); await new Promise(r => setTimeout(r, +(process.env.PS_AFTER || 1500))); }
    const err = await send('Runtime.evaluate', { expression: "document.getElementById('err').textContent" });
    if (err.result.result.value) console.log('BŁĄD na stronie:', err.result.result.value.slice(0, 1500));
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
    console.log('saved', out);
    done(0);
  } catch (e) { console.log('pageshot:', e.message); done(1); }
}, +wait * 1000);
