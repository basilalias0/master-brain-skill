'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

test('arena log line from procedure 05 is accepted', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'procedure', '05-arena-and-decisions.md'), 'utf8');
  const line = text.split('\n').find((l) => /route-log\.cjs append/.test(l) && /--task arena/.test(l));
  assert.ok(line, 'procedure 05 has the arena route-log line');
  const cmd = /`(node <skill_dir>\/scripts\/route-log\.cjs append [^`]+)`/.exec(line)[1];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mb-rl-'));
  const filled = cmd.replace('<master_dir>', dir).replace('pass|fail', 'pass').replace('<integer>', '2400000');
  const args = (filled.match(/"[^"]*"|\S+/g) || []).map((a) => a.replace(/^"|"$/g, ''));
  assert.strictEqual(args[0], 'node');
  args[1] = path.join(__dirname, 'route-log.cjs');
  const r = cp.spawnSync('node', args.slice(1), { encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stderr);
  const row = JSON.parse(fs.readFileSync(path.join(dir, 'routing-log.jsonl'), 'utf8').trim());
  assert.strictEqual(row.task, 'arena');
  assert.strictEqual(row.tokens, 2400000);
});

test('size and pct are recorded for scale.cjs and checked', () => {
  const { build } = require('./route-log.cjs');
  const r = build({ task: 'build', start: 'T1', result: 'pass', size: 'L', pct: '7', tokens: '400000' });
  assert.strictEqual(r.size, 'L');
  assert.strictEqual(r.pct, 7);
  assert.throws(() => build({ task: 'build', start: 'T1', result: 'pass', size: 'huge' }), /--size/);
  assert.throws(() => build({ task: 'build', start: 'T1', result: 'pass', pct: '140' }), /--pct/);
});

test('from-result reads a RESULT block: done = pass, needs-master = fail with rework; flags win', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mb-rl-'));
  const log = path.join(dir, 'routing-log.jsonl');
  const res = path.join(dir, 'W-M1-2.md');
  fs.writeFileSync(res, '# W-M1-2\n## LAST\nstatus:           done\ncommit:           abc123\ngates:            tsc pass · unit pass\ntest-guard:       ok\n## older\nstatus: blocked\n');
  const S = path.join(__dirname, 'route-log.cjs');
  const r = cp.spawnSync('node', [S, 'from-result', res, '--log', log, '--task', 'bugfix', '--start', 'T1', '--size', 'M', '--pct', '3'], { encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stderr);
  const row = JSON.parse(fs.readFileSync(log, 'utf8').trim());
  assert.deepStrictEqual([row.result, row.rework, row.size, row.pct], ['pass', false, 'M', 3]);
  assert.match(row.note, /commit abc123; gates tsc pass/);
  const { fromResult } = require('./route-log.cjs');
  const back = fromResult('status: needs-master\ncommit: none\n', { task: 'build', start: 'T1' });
  assert.deepStrictEqual([back.result, back.rework], ['fail', 'yes']);
  assert.strictEqual(fromResult('status: done\ntest-guard: violations\n', {}).rework, 'yes');
  assert.strictEqual(fromResult('status: blocked\n', { result: 'pass' }).result, 'pass');
  assert.throws(() => fromResult('no block here\n', {}), /not a RESULT block/);
  assert.strictEqual(cp.spawnSync('node', [S, 'from-result', '--log', log], { encoding: 'utf8' }).status, 2);
});
