'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { snapshot, compare } = require('./test-guard.cjs');

function fixture() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mb-tg-'));
  fs.writeFileSync(path.join(d, 'a.test.js'), "test('one', () => { expect(1).toBe(1); });\ntest('two', () => { expect(2).toBe(2); });\n");
  return d;
}

test('unchanged tree passes', () => {
  const d = fixture();
  assert.deepStrictEqual(compare(d, snapshot(d)), []);
});

test('removed test, new skip, fewer assertions all fail', () => {
  const d = fixture();
  const snap = snapshot(d);
  fs.writeFileSync(path.join(d, 'a.test.js'), "test.skip('one', () => {});\n");
  const v = compare(d, snap).join('|');
  assert.match(v, /tests 2 -> 1/);
  assert.match(v, /skip/);
  assert.match(v, /assertions/);
});

test('removed file fails; added tests pass', () => {
  const d = fixture();
  const snap = snapshot(d);
  fs.writeFileSync(path.join(d, 'b.test.js'), "test('x', () => { expect(1).toBe(1); });\n");
  assert.deepStrictEqual(compare(d, snap), []);
  fs.rmSync(path.join(d, 'a.test.js'));
  assert.match(compare(d, snap)[0], /removed/);
});
