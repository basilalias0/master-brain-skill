'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { analyse } = require('./route-stats.cjs');

const entry = (o) => ({ task: 'bugfix', start: 'T1', result: 'pass', ...o });

test('proposals carry a type: routing, local-rule, generic', () => {
  const lowered = Array.from({ length: 8 }, () => entry({ start: 'T0' })).concat(Array.from({ length: 8 }, () => entry()));
  const a = analyse(lowered, { min: 8, defaults: { bugfix: 'T1' } });
  assert.strictEqual(a.proposals[0].type, 'routing');
  const reworked = Array.from({ length: 8 }, (_, i) => entry({ task: 'build', rework: i < 4 }));
  assert.strictEqual(analyse(reworked, { min: 8 }).proposals[0].type, 'local-rule');
  const many = Array.from({ length: 16 }, (_, i) => entry({ task: 'build', rework: i < 8 }));
  assert.strictEqual(analyse(many, { min: 8 }).proposals[0].type, 'generic');
});

test('report --write records last-run.json; state nudges at 10 new log lines, not before', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mb-im-'));
  fs.writeFileSync(path.join(d, 'STATE.md'), 'state\n');
  fs.writeFileSync(path.join(d, 'BOARD.md'), '| a |\n|---|\n| x open |\n');
  const log = path.join(d, 'routing-log.jsonl');
  const lines = (n) => Array.from({ length: n }, () => JSON.stringify(entry())).join('\n') + '\n';
  const state = () => spawnSync('node', [path.join(__dirname, 'state.cjs'), d], { encoding: 'utf8' }).stdout;
  fs.writeFileSync(log, lines(9));
  assert.doesNotMatch(state(), /Nudge/);
  fs.writeFileSync(log, lines(10));
  assert.match(state(), /Nudge: 10 tasks/);
  spawnSync('node', [path.join(__dirname, 'route-stats.cjs'), 'report', log, '--write', path.join(d, 'improve', 'proposals')]);
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(d, 'improve', 'last-run.json'), 'utf8')).entries, 10);
  assert.doesNotMatch(state(), /Nudge/);
  fs.writeFileSync(log, lines(20));
  assert.match(state(), /Nudge: 10 tasks/);
  assert.ok(state().split('\n').filter(Boolean).length <= 15);
});
