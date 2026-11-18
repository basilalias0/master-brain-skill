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

test('a lock being written (folder, no owner file yet) is not stolen', () => {
  const d = tmp();
  fs.mkdirSync(dirOf(d, 'mid'), { recursive: true });
  assert.strictEqual(acquire(d, 'mid', 'B', 60).ok, false);
});

test('an old folder with no owner file is a crash leftover and is reclaimed', () => {
  const d = tmp();
  const p = dirOf(d, 'old');
  fs.mkdirSync(p, { recursive: true });
  const t = new Date(Date.now() - 60e3);
  fs.utimesSync(p, t, t);
  assert.ok(acquire(d, 'old', 'B', 60).ok);
});

test('while another contender reclaims a stale lock, nobody else deletes it', () => {
  const d = tmp();
  assert.ok(acquire(d, 's', 'A', 60).ok);
  fs.writeFileSync(path.join(dirOf(d, 's'), 'owner.json'), JSON.stringify({ owner: 'A', time: 0, expires: 1 }));
  fs.mkdirSync(dirOf(d, 's') + '.steal');
  assert.strictEqual(acquire(d, 's', 'B', 60).ok, false);
  fs.rmdirSync(dirOf(d, 's') + '.steal');
  assert.ok(acquire(d, 's', 'B', 60).ok);
});
