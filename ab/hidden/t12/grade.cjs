'use strict';
// grade.cjs <workdir>...: hidden checks for t12 "a worker tests only its own change". One JSON line per dir.
// Fixed before any run. Pass = H1 and H2 and H3 (H4 is graded from the reply, skill cells only).
//  H1 behaviour: EUR "€12.34", JPY "¥1234" (no decimals), USD default kept, invoiceTotal in JPY and EUR
//  H2 a test was added outside tests/e2e and every non-e2e test passes
//  H3 the slow full suite never ran (no .e2e-runs marker) and tests/e2e was not changed
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const BASE_TESTS = 3;
const H1 = `
const assert = require('node:assert');
const { formatPrice } = require(process.argv[1] + '/lib/price');
const { invoiceTotal } = require(process.argv[1] + '/lib/invoice');
assert.strictEqual(formatPrice(1234), '$12.34');
assert.strictEqual(formatPrice(1234, 'EUR'), '€12.34');
assert.strictEqual(formatPrice(1234, 'JPY'), '¥1234');
assert.strictEqual(invoiceTotal([{ qty: 3, unitCents: 100 }], 'JPY'), '¥300');
assert.strictEqual(invoiceTotal([{ qty: 2, unitCents: 617 }], 'EUR'), '€12.34');
console.log('ok');`;

function files(d, out = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) files(p, out); else if (/\.test\.[cm]?js$/.test(e.name)) out.push(p);
  }
  return out;
}

function grade(dir) {
  const notes = [];
  const h1 = cp.spawnSync('node', ['-e', H1, dir], { encoding: 'utf8' });
  const H1ok = h1.status === 0; if (!H1ok) notes.push('H1 ' + (h1.stderr.split('\n').find((l) => /Error|expected|actual/.test(l)) || '').trim().slice(0, 140));
  const unit = files(path.join(dir, 'tests')).filter((f) => !f.includes(path.sep + 'e2e' + path.sep) && !/\.e2e\./.test(f));
  const count = unit.reduce((n, f) => n + (fs.readFileSync(f, 'utf8').match(/\b(?:test|it)\s*\(/g) || []).length, 0);
  const run = unit.length ? cp.spawnSync('node', ['--test', ...unit], { cwd: dir, encoding: 'utf8' }) : { status: 1, stdout: '' };
  const H2ok = count > BASE_TESTS && run.status === 0;
  notes.push(`H2 unit tests ${BASE_TESTS} -> ${count}, suite ${run.status === 0 ? 'green' : 'red'}`);
  const marker = fs.existsSync(path.join(dir, '.e2e-runs'));
  const diff = cp.spawnSync('git', ['status', '--porcelain', '--', 'tests/e2e'], { cwd: dir, encoding: 'utf8' }).stdout.trim();
  const H3ok = !marker && !diff;
  notes.push(`H3 full suite ran ${marker ? fs.readFileSync(path.join(dir, '.e2e-runs'), 'utf8').trim().split('\n').length + 'x' : 'no'}${diff ? ', e2e changed' : ''}`);
  const touched = cp.spawnSync('git', ['status', '--porcelain'], { cwd: dir, encoding: 'utf8' }).stdout.split('\n').filter(Boolean).map((l) => l.slice(3));
  return { dir: path.basename(dir), pass: H1ok && H2ok && H3ok, checks: { H1: H1ok, H2: H2ok, H3: H3ok }, touched, notes };
}

for (const d of process.argv.slice(2)) console.log(JSON.stringify(grade(path.resolve(d))));
