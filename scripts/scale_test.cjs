'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const { classify, plan } = require('./scale.cjs');

const S = path.join(__dirname, 'scale.cjs');
const t = (id, size, deps = [], extra = {}) => ({ id, size, deps, ...extra });

test('size: small stays with the Master, parallel parts go to workers unasked, big goes to scale mode', () => {
  assert.strictEqual(classify({ files: 1, hours: 0.1 }).class, 'S');
  assert.strictEqual(classify({ files: 5, hours: 1 }).class, 'M');
  assert.strictEqual(classify({ files: 8, areas: 2, parts: 3, hours: 3 }).class, 'L');
  assert.match(classify({ files: 8, areas: 2, parts: 3, hours: 3 }).path, /without being asked/);
  assert.strictEqual(classify({ parts: 6, hours: 40 }).class, 'XL');
  assert.strictEqual(classify({ areas: 3, parts: 2, isNew: true }).class, 'XL');
});

test('plan: independent tasks finish faster with more workers; the chain bounds it', () => {
  const p = { tasks: [t('base', 'M'), t('a', 'M', ['base']), t('b', 'M', ['base']), t('c', 'M', ['base']), t('d', 'M', ['base'])] };
  const r = plan(p, { cap: 4 });
  assert.strictEqual(r.width, 4);
  assert.strictEqual(r.rows[0].wall, 10);
  assert.strictEqual(r.rows[3].wall, 4);
  assert.strictEqual(r.rows[3].bound, 'dependencies');
  assert.ok(r.rows[3].tokens > r.rows[0].tokens, 'each worker adds its boot cost');
  assert.strictEqual(r.pick.n, 4);
});

test('plan: never more workers than the widest wave, and a pure chain recommends 1', () => {
  const r = plan({ tasks: [t('a', 'S'), t('b', 'S', ['a']), t('c', 'S', ['b'])] }, { cap: 6 });
  assert.strictEqual(r.rows.length, 1);
  assert.strictEqual(r.pick.n, 1);
});

test('plan: the 5-hour window can bound the wall time, which more workers cannot fix', () => {
  const tasks = Array.from({ length: 8 }, (_, i) => t('x' + i, 'L'));
  const r = plan({ tasks }, { cap: 4, pct5h: 40, left5h: 50 });
  const four = r.rows[3];
  assert.ok(four.windows5h >= 1);
  assert.strictEqual(four.bound, '5-hour window');
});

test('plan: human-days and the routing-log calibration show up', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scale-'));
  const log = path.join(dir, 'routing-log.jsonl');
  fs.writeFileSync(log, [1, 2, 3].map((k) => JSON.stringify({ task: 'build', size: 'M', tokens: k * 100e3 })).join('\n'));
  const r = plan({ tasks: [t('a', 'M', [], { human_days: 5 }), t('b', 'M', [], { human_days: 5 })] }, { cap: 2, log });
  assert.match(r.cal, /routing log median \(M n=3\)/);
  assert.strictEqual(r.human, 10);
  assert.strictEqual(r.rows[0].tokens, 2 * (200e3 + 15e3) + 120e3);
});

test('plan: unknown deps and cycles exit 2', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scale-'));
  const f = path.join(dir, 'p.json');
  fs.writeFileSync(f, JSON.stringify({ tasks: [t('a', 'S', ['b']), t('b', 'S', ['a'])] }));
  assert.strictEqual(cp.spawnSync('node', [S, 'plan', f]).status, 2);
  fs.writeFileSync(f, JSON.stringify({ tasks: [t('a', 'S', ['zz'])] }));
  assert.strictEqual(cp.spawnSync('node', [S, 'plan', f]).status, 2);
  fs.writeFileSync(f, JSON.stringify({ tasks: [t('a', 'S'), t('b', 'M')] }));
  const ok = cp.spawnSync('node', [S, 'plan', f, '--cap', '2'], { encoding: 'utf8' });
  assert.strictEqual(ok.status, 0);
  assert.match(ok.stdout, /recommend \d worker/);
  assert.match(ok.stdout, /windows not estimated/);
});

test('plan: --pct5h comes from the log when it is not given', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scale-'));
  const log = path.join(dir, 'routing-log.jsonl');
  fs.writeFileSync(log, [5, 6, 7].map((p) => JSON.stringify({ task: 'build', size: 'M', tokens: 500e3, pct: p })).join('\n'));
  const r = plan({ tasks: [t('a', 'M')] }, { log });
  assert.strictEqual(r.o.pct5h, 12);
  assert.strictEqual(r.rows[0].windows5h, 0);
});

test('size with the five effort factors prints tier and effort from the MODELS score', () => {
  const { effort } = require('./scale.cjs');
  assert.strictEqual(effort({ files: 1 }), null, 'no factors: no effort line');
  assert.deepStrictEqual(effort({ clarity: 0, reach: 1, checking: 0 }), { score: 1, effort: 'low', tier: 'T0', note: '' });
  assert.strictEqual(effort({ clarity: 1, checking: 1 }).tier, 'T1');
  assert.strictEqual(effort({ clarity: 2, reach: 1, mistake: 1, newness: 1 }).effort, 'medium');
  assert.strictEqual(effort({ clarity: 2, reach: 2, mistake: 2, newness: 1, checking: 1 }).effort, 'xhigh');
  assert.strictEqual(effort({ clarity: 2, reach: 2, mistake: 2, newness: 1, checking: 1 }).tier, 'T2');
  assert.match(effort({ clarity: 2, reach: 2, mistake: 2, newness: 2, checking: 2 }).note, /human's yes/);
  assert.deepStrictEqual([effort({ clarity: 1, risk: true }).effort, effort({ clarity: 1, risk: true }).tier], ['high', 'T1']);
  assert.throws(() => effort({ clarity: 3 }), /0, 1 or 2/);
  const r = cp.spawnSync('node', [S, 'size', '--files', '2', '--hours', '1', '--clarity', '1', '--reach', '1', '--mistake', '1', '--newness', '0', '--checking', '1'], { encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, /^M: /);
  assert.match(r.stdout, /tier T1 .*effort medium: score 4\/10/);
});
