// Loads the game scripts (in index.html order) into a Node VM context with stubbed browser globals.
// opts.before(ctx): adjust the context before the scripts run (e.g. a fake WebSocket).
const fs = require('fs'), path = require('path'), vm = require('vm');
module.exports = function load(opts = {}) {
  const root = path.join(__dirname, '..', '..');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const files = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]).filter(f => !f.endsWith('main.js') && !f.endsWith('menu.js') && !f.endsWith('update-check.js'));
  const ctx = { console, performance: { now: () => 0 }, setTimeout: f => f(), clearTimeout() {}, requestAnimationFrame() {}, location: { protocol: 'file:' } };
  ctx.window = ctx; ctx.addEventListener = () => {};
  ctx.document = { getElementById: () => ({ style: {} }), addEventListener: () => {} };
  if (opts.before) opts.before(ctx);
  vm.createContext(ctx);
  for (const f of files) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
  return ctx;
};
