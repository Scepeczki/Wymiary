// Usage: node tools/dev/tutorial.js — plays the 4D tutorial with scripted inputs: every lesson's tasks must be
// recognised as done and the tutorial must move on to the next lesson by itself.
const ctx = require('./load')();
const { WE, W4D } = ctx;
const w = WE.worlds.find(x => x.name === 'Samouczek 4D');
WE.world = w;
WE.probe = pts => pts.map(p => p[1]);   // an endless floor (enough for these checks)
w.enter({});
const step = (n, keys = {}) => { for (let i = 0; i < n; i++) { WE.time += 1 / 60; WE.keys = Object.assign({}, keys); w.update(1 / 60, { dx: 0, dy: 0 }); } };
const until = (cond, keys, max = 1200) => { for (let i = 0; i < max && !cond(); i++) step(1, keys); return cond(); };
const pos = () => w.player.pos;
let fail = 0;
const lesson = (n, title, run) => {
  if (w.lesson !== n) { console.log(`ŹLE  oczekiwano lekcji ${n + 1}, jest ${w.lesson + 1}`); fail++; w.setLesson(n); }
  run();
  const done = w.step >= w._test.L[n].tasks.length;
  if (!done) fail++;
  console.log(`${done ? 'OK ' : 'ŹLE'}  ${n + 1}. ${title}${done ? '' : ` — zadanie ${w.step + 1} niezaliczone`}`);
  if (n < w._test.L.length - 1) step(60 * 4.3);          // auto-advance
};
lesson(0, 'osie x, y, z', () => {
  w.player.pos = [7.5, 1.6, 0.2, 0]; step(2);
  w.player.pos = [0.2, 1.6, 7.5, 0]; step(2);
  step(1, { Space: true }); step(20);
});
lesson(1, 'krok w W', () => { until(() => Math.abs(pos()[3] - 4) < 0.3, { KeyT: true }); step(2); });
lesson(2, 'hiperkula i brama', () => {
  until(() => pos()[3] < 2, { KeyG: true }); until(() => pos()[3] > 6, { KeyT: true });
  w.player.pos = [0, 1.6, 15, 4]; until(() => pos()[2] > 16.3, { KeyW: true }, 200);
  until(() => Math.abs(pos()[3]) < 0.2, { KeyG: true }); step(2);
});
lesson(3, 'obrót Q / E', () => {
  until(() => w.player.forward[3] > 0.97, { KeyE: true });
  until(() => w.step >= 2, { KeyW: true }, 600);
  W4D.startSnap(w, 1); step(60);
});
lesson(4, 'obrót Z / C', () => { until(() => Math.abs(w.player.right[3]) > 0.97, { KeyC: true }); W4D.startSnap(w, 0); step(60); });
lesson(5, 'kamera (x y z)', () => { w.view = 1; step(2); });
lesson(6, 'kamera (w y z)', () => { until(() => pos()[3] > 1.7, { KeyT: true }); w.view = 2; step(2); });
lesson(7, 'kamera (x w z)', () => { until(() => pos()[3] > 5.4, { KeyT: true }); w.view = 3; step(2); });
lesson(8, 'kamera (x y w)', () => { until(() => w.wTravel > 4.2, { KeyT: true }); w.view = 0; step(2); });
lesson(9, 'cztery kamery', () => {
  w.split = true; step(2);
  until(() => Math.abs(w.player.forward[3]) > 0.55, { KeyE: true });
  W4D.startSnap(w, 1); step(60);
  w.split = false; step(2);
});
lesson(10, 'sprawdzian', () => { w.player.pos = [12, 1.6, 12.4, 0.3]; step(2); });
console.log(fail ? `BŁĘDÓW: ${fail}` : 'samouczek przechodzi się w całości');
process.exit(fail ? 1 : 0);
