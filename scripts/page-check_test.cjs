'use strict';
// The browser cases need a Playwright install: set MB_PLAYWRIGHT_DIR to a project folder that has one; else they skip.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const cp = require('child_process');

const S = path.join(__dirname, 'page-check.cjs');
const PW = process.env.MB_PLAYWRIGHT_DIR;
const run = (cwd, ...a) => new Promise((res) => {
  const p = cp.spawn('node', [S, ...a], { cwd });
  let out = ''; p.stdout.on('data', (d) => (out += d)); p.stderr.on('data', (d) => (out += d));
  p.on('exit', (code) => res({ code, out }));
});
function serve(htmlRef) {
  return new Promise((res) => {
    const s = http.createServer((q, r) => { r.setHeader('content-type', 'text/html'); r.end(htmlRef.html); }).listen(0, () => res(s));
  });
}
const page = (color, label) => `<!doctype html><body style="margin:0;font:16px sans-serif">
<div id="card" style="width:300px;height:120px;background:${color};animation:spin 2s infinite">${label}</div>
<style>@keyframes spin{to{transform:rotate(360deg)}}</style></body>`;

test('without Playwright in the project it says "not run" and exits 3, never installs', async () => {
  const r = await run(fs.mkdtempSync(path.join(os.tmpdir(), 'mb-pc-')), 'http://127.0.0.1:9/');
  assert.strictEqual(r.code, 3, r.out);
  assert.match(r.out, /not run: Playwright is not installed/);
});

test('text checks, baseline create, match, and a cropped diff on change', { skip: !PW && 'MB_PLAYWRIGHT_DIR not set' }, async () => {
  const ref = { html: page('#3366cc', 'Total: 42') };
  const s = await serve(ref); const url = `http://127.0.0.1:${s.address().port}/`;
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mb-pc-'));
  const base = path.join(d, 'card.png'); const out = path.join(d, 'out');
  try {
    const a = await run(PW, url, '--wait-for', '#card', '--text', 'Total: 42', '--element', '#card', '--baseline', base, '--out', out);
    assert.strictEqual(a.code, 0, a.out); assert.match(a.out, /baseline created/);
    const b = await run(PW, url, '--element', '#card', '--baseline', base, '--out', out);
    assert.strictEqual(b.code, 0, b.out); assert.match(b.out, /image matches/, 'animation must be frozen');
    const c = await run(PW, url, '--text', 'Total: 43');
    assert.strictEqual(c.code, 1); assert.match(c.out, /missing text: "Total: 43"/);
    ref.html = page('#cc3333', 'Total: 42');
    const e = await run(PW, url, '--element', '#card', '--baseline', base, '--out', out);
    assert.strictEqual(e.code, 1, e.out); assert.match(e.out, /image differs: .* look at .*changed\.png only/);
    assert.ok(fs.existsSync(path.join(out, 'changed.png')) && fs.existsSync(path.join(out, 'diff.png')));
  } finally { s.close(); }
});
