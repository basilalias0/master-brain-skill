'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { build, append } = require('./route-log.cjs');
const { analyse, load, render } = require('./route-stats.cjs');
const { add, list } = require('./failure-case.cjs');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mb-im-'));
const log = (file, n, o) => { for (let i = 0; i < n; i++) append(file, { task: 'bugfix', start: 'T1', result: 'pass', tokens: 1000, ...o }); };

test('route-log validates and records escalation', () => {
  assert.throws(() => build({ task: 'Bad Task', start: 'T1', result: 'pass' }));
  assert.throws(() => build({ task: 'x', start: 'T9', result: 'pass' }));
  assert.throws(() => build({ task: 'x', start: 'T1', result: 'maybe' }));
  const r = build({ task: 'x', start: 'T0', final: 'T1', result: 'pass', note: 'a\nb' });
  assert.strictEqual(r.escalated, true);
  assert.strictEqual(r.note, 'a b');
});

test('no proposal below the sample minimum', () => {
  const f = path.join(tmp(), 'l.jsonl'); log(f, 5, { start: 'T0' });
  const r = analyse(load(f), { min: 8, defaults: { bugfix: 'T1' } });
  assert.deepStrictEqual(r.proposals, []);
  assert.match(r.collecting[0], /5\/8/);
});

test('proposes lowering when a cheaper tier passes first try, raising when the default fails', () => {
  const f = path.join(tmp(), 'l.jsonl');
  log(f, 9, { start: 'T0' }); log(f, 3, { start: 'T1' });
  let r = analyse(load(f), { min: 8, defaults: { bugfix: 'T1' } });
  assert.strictEqual(r.proposals[0].kind, 'lower');
  assert.match(r.proposals[0].text, /T1 to T0/);
  const g = path.join(tmp(), 'g.jsonl');
  log(g, 4, { start: 'T1' }); log(g, 6, { start: 'T1', final: 'T2' });
  r = analyse(load(g), { min: 8, defaults: { bugfix: 'T1' } });
  assert.strictEqual(r.proposals[0].kind, 'raise');
  assert.match(render(r, 8), /Proposals/);
});

test('rework and correction rates raise brief and review proposals', () => {
  const f = path.join(tmp(), 'l.jsonl'); log(f, 6, { rework: 'no', correction: 'no' }); log(f, 4, { rework: 'yes', correction: 'yes' });
  const kinds = analyse(load(f), { min: 8, defaults: { bugfix: 'T1' } }).proposals.map((p) => p.kind);
  assert.ok(kinds.includes('brief') && kinds.includes('review'));
});

test('failure cases are written once and listed', () => {
  const d = tmp();
  add(d, { id: 'skip-test', task: 'make it green', wrong: 'skipped the test', expected: 'reports the wrong test' });
  assert.throws(() => add(d, { id: 'skip-test', task: 'a', wrong: 'b', expected: 'c' }));
  assert.match(list(d)[0], /skip-test: new/);
});
