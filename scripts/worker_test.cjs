'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const { choose } = require('./worker.cjs');

test('hard rules come before cost: steer, outlive, rollover, cap, XL', () => {
  assert.strictEqual(choose({ size: 'M', steer: true }).pick, 'worker chat');
  assert.strictEqual(choose({ size: 'M', outlive: true }).pick, 'worker chat');
  assert.strictEqual(choose({ size: 'M', 'master-ctx': 235000 }).pick, 'roll over first');
  assert.strictEqual(choose({ size: 'M', running: 2 }).pick, 'worker chat');
  assert.strictEqual(choose({ size: 'M', running: 3, cap: 4 }).pick, 'subagent');
  assert.strictEqual(choose({ size: 'XL' }).pick, 'scale mode');
});

test('the formula: a subagent wins by default; a big boot gap or long Master chat only widens it', () => {
  const r = choose({ size: 'M', 'master-ctx': 100000 });
  assert.strictEqual(r.pick, 'subagent');
  assert.strictEqual(r.sub, 40000 + 120000 + 10000 + 6000);
  assert.strictEqual(r.chat, 100000 + 120000 + 30000);
  assert.strictEqual(choose({ size: 'M', warm: 80000 }).chat, 100000 + 120000 + 160000);
});

test('a cheap measured chat boot can make the chat the pick', () => {
  assert.strictEqual(choose({ size: 'S', 'boot-chat': 20000 }).pick, 'worker chat');
});

test('boots calibrate from the routing log after 3 tasks per kind', () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mb-w-')), 'routing-log.jsonl');
  fs.writeFileSync(f, [50e3, 60e3, 70e3].map((b) => JSON.stringify({ worker: 'sub', boot: b })).join('\n'));
  const r = choose({ size: 'M', log: f });
  assert.match(r.basis, /measured \(sub n=3\)/);
  assert.strictEqual(r.sub, 60000 + 120000 + 6000);
});

test('the command prints one line and exits 2 on bad input', () => {
  const S = path.join(__dirname, 'worker.cjs');
  const ok = cp.spawnSync('node', [S, 'choose', '--size', 'L', '--master-ctx', '150000'], { encoding: 'utf8' });
  assert.strictEqual(ok.status, 0);
  assert.match(ok.stdout, /^subagent: subagent is cheaper \(subagent \d+k vs chat \d+k; uncalibrated defaults\)\n$/);
  assert.strictEqual(cp.spawnSync('node', [S, 'choose', '--size', 'Q']).status, 2);
});
