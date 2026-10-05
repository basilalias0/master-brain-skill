'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { acquire, release, dirOf } = require('./lock.cjs');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mb-lock-'));

test('second owner is refused, release frees it', () => {
  const d = tmp();
  assert.ok(acquire(d, 'heavy', 'A', 60).ok);
  assert.strictEqual(acquire(d, 'heavy', 'B', 60).ok, false);
  assert.strictEqual(release(d, 'heavy', 'B').ok, false);
  assert.ok(release(d, 'heavy', 'A').ok);
  assert.ok(acquire(d, 'heavy', 'B', 60).ok);
});

test('same owner refreshes; expired lock can be taken', () => {
  const d = tmp();
  assert.ok(acquire(d, 'x', 'A', 60).ok);
  assert.ok(acquire(d, 'x', 'A', 60).refreshed);
  fs.writeFileSync(path.join(dirOf(d, 'x'), 'owner.json'), JSON.stringify({ owner: 'A', time: 0, expires: 1 }));
  assert.ok(acquire(d, 'x', 'B', 60).ok);
});

test('force release works for any owner', () => {
  const d = tmp();
  acquire(d, 'y', 'A', 60);
  assert.ok(release(d, 'y', 'Z', true).ok);
});
