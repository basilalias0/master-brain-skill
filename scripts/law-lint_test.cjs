'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { caps, stamp, digestHash, sha } = require('./law-lint.cjs');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mb-ll-'));

test('caps flags long md and honours the exempt file', () => {
  const d = tmp();
  fs.writeFileSync(path.join(d, 'big.md'), 'x\n'.repeat(250));
  fs.mkdirSync(path.join(d, 'third'));
  fs.writeFileSync(path.join(d, 'third', 'big.md'), 'x\n'.repeat(250));
  fs.writeFileSync(path.join(d, 'ex.txt'), '# third party\nthird\n');
  assert.deepStrictEqual(caps(d, path.join(d, 'ex.txt')).map((s) => s.split(':')[0]), ['big.md']);
  assert.strictEqual(caps(d).length, 2);
});

test('stamp writes the hash and digest-check detects a changed LAWS', () => {
  const d = tmp();
  const laws = path.join(d, 'LAWS.md');
  const dig = path.join(d, 'LAWS_DIGEST.md');
  fs.writeFileSync(laws, 'law 1\n');
  fs.writeFileSync(dig, '# digest\n- short\n');
  stamp(laws, dig);
  assert.strictEqual(digestHash(dig), sha(laws));
  fs.writeFileSync(laws, 'law 1 changed\n');
  assert.notStrictEqual(digestHash(dig), sha(laws));
});

const FX = path.join(__dirname, 'fixtures', 'onboarded', 'master-brain');
const TEMPLATE = path.join(__dirname, '..', 'templates', 'LAWS.md');
// The text of law n: from the line "n. " up to the next numbered law or heading; null when the law does not exist.
function law(file, n) {
  const lines = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n').split('\n');
  const i = lines.findIndex((l) => l.startsWith(`${n}. `));
  if (i < 0) return null;
  const rest = lines.slice(i + 1);
  const j = rest.findIndex((l) => /^\d+\. |^## /.test(l));
  return [lines[i], ...(j < 0 ? rest : rest.slice(0, j))].join('\n').trim();
}

test('onboarded fixture digest matches its laws', () => {
  const laws = path.join(FX, 'LAWS.md');
  const dig = path.join(FX, 'LAWS_DIGEST.md');
  assert.strictEqual(digestHash(dig), sha(laws));
  assert.ok(fs.readFileSync(dig, 'utf8').trim().split('\n').length <= 30, 'digest is 30 lines or fewer');
});

test("onboarded fixture law lines 4, 14, 20, 25 equal the template's", () => {
  for (const n of [4, 14, 20, 25]) assert.strictEqual(law(path.join(FX, 'LAWS.md'), n), law(TEMPLATE, n), `law ${n}`);
  assert.ok(law(TEMPLATE, 4) && law(TEMPLATE, 14) && law(TEMPLATE, 20));
});
