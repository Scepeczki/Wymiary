// Usage: node tools/dev/check.js [path-to-glslang.exe]  — validates every world shader with Khronos glslang
// (download: github.com/KhronosGroup/glslang/releases, tag main-tot, windows-x86_64-release.zip)
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const ctx = require('./load')();
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'wymiary-')), glslang = process.argv[2] || process.env.GLSLANG || 'glslang';
let fail = 0;
ctx.WE.worlds.forEach((w, i) => {
  const s = w.shader();
  for (const kind of ['render', 'probe']) {
    const file = path.join(out, `w${i}_${kind}.frag`);
    fs.writeFileSync(file, s[kind]);
    try { cp.execFileSync(glslang, [file], { encoding: 'utf8' }); console.log(`OK   ${w.name} / ${kind}`); }
    catch (e) { fail++; console.log(`FAIL ${w.name} / ${kind}\n${(e.stdout || '') + (e.stderr || '')}`); }
  }
});
process.exit(fail ? 1 : 0);
