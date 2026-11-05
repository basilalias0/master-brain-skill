'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const { budget, factor, weight } = require('./capacity.cjs');

const run = (args, specJson) =>
  cp.spawnSync('node', [path.join(__dirname, 'capacity.cjs'), ...args], {
    encoding: 'utf8',
    env: { ...process.env, MB_SPEC: specJson || '{"ramGB":15.3,"cores":12,"host":"a"}' },
  });

test('budget follows the machine: RAM minus 3, capped by cores, never under 4', () => {
  assert.strictEqual(budget({ ramGB: 15.3, cores: 12 }), 12); // the calibrated history machine
  assert.strictEqual(budget({ ramGB: 7.8, cores: 8 }), 4); // 8 GB laptop
  assert.strictEqual(budget({ ramGB: 31.9, cores: 8 }), 8); // RAM-rich, core-poor
  assert.strictEqual(budget({ ramGB: 4, cores: 2 }), 4); // floor
});

test('weights and the context factor match the approved plan', () => {
  assert.strictEqual(weight('6:sup:active').w, 2);
  assert.strictEqual(weight('7:sup:active').w, 2.25);
  assert.strictEqual(weight('6:do:active').w, 4);
  assert.strictEqual(weight('3:sub:active').w, 1.5);
  assert.strictEqual(weight('0:master:active').w, 1.5);
  assert.strictEqual(weight('5:do:wait').w, 0.75);
  assert.strictEqual(weight('5:lock:bg').w, 1);
  assert.strictEqual(weight('9:do:queued').w, 0);
  assert.deepStrictEqual([factor(34), factor(50), factor(70), factor(85)], [1, 0.8, 0.6, 0]);
  assert.throws(() => weight('11:do:active'));
  assert.throws(() => weight('5:nap:active'));
});

test('load: M9 on 2026-11-05 is full (14.75 at 85% context); v14a round fits', () => {
  const m9 = run(['load', 'master', '85', '6:sup:active', '6:sup:active', '7:sup:active', '7:sup:active', '7:sup:active', '6:do:active']);
  assert.strictEqual(m9.status, 1);
  assert.match(m9.stdout, /load 14\.75 \/ 0 /);
  assert.match(m9.stdout, /write the LAST block/);
  const v14a = run(['load', 'master', '40', '5:sup:active', '6:sup:active', '6:sup:active', '5:do:active', '--new', '2:sup:active']);
  assert.strictEqual(v14a.status, 0);
  assert.match(v14a.stdout, /take it/);
});

test('load: a fifth running worker chat breaks the Master hard cap', () => {
  const r = run(['load', 'master', '10', '1:sup:active', '1:sup:active', '1:sup:active', '1:sup:active', '1:sup:bg']);
  assert.strictEqual(r.status, 1);
  assert.match(r.stdout, /5 worker chats running \(cap 4\)/);
});

test('calibrate writes CAPACITY.md; check is silent until the machine changes', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mb-cap-'));
  const first = run(['check', d]);
  assert.strictEqual(first.status, 0);
  assert.match(first.stdout, /calibrated for this machine, budget 12/);
  const md = fs.readFileSync(path.join(d, 'CAPACITY.md'), 'utf8');
  assert.match(md, /15\.3 GB RAM, 12 logical cores, so the budget is \*\*12 machine points\*\*/);
  assert.ok(!md.includes('"host":"a"'), 'host name is hashed, never stored');
  assert.strictEqual(run(['check', d]).stdout, '');
  const moved = run(['check', d], '{"ramGB":7.8,"cores":4,"host":"b"}');
  assert.match(moved.stdout, /machine changed, recalibrated: budget 4 \(was 12\)/);
  assert.match(fs.readFileSync(path.join(d, 'CAPACITY.md'), 'utf8'), /Small machine/);
});

test('bad input exits 2', () => {
  assert.strictEqual(run(['load', 'boss', '10', '1:do:active']).status, 2);
  assert.strictEqual(run(['nope']).status, 2);
});
