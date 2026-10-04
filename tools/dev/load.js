// Loads the game scripts (in index.html order) into a Node VM context with stubbed browser globals.
const fs = require('fs'), path = require('path'), vm = require('vm');
module.exports = function load() {
  const root = path.join(__dirname, '..', '..');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const files = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]).filter(f => !f.endsWith('main.js') && !f.endsWith('menu.js'));
  const ctx = { console, performance: { now: () => 0 }, setTimeout: f => f(), clearTimeout() {}, requestAnimationFrame() {} };
  ctx.window = ctx; ctx.addEventListener = () => {};
  ctx.document = { getElementById: () => ({ style: {} }), addEventListener: () => {} };
  vm.createContext(ctx);
  for (const f of files) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
  return ctx;
};
