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
