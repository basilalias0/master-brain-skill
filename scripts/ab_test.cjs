'use strict';
// Tests for the maintainer A/B harness (ab/ab.cjs): planning, prepare from a git ref, grading an untouched run.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ab = require('../ab/ab.cjs');

const out = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mb-ab-'));

test('plan: one run per task, cell and rep, numbered from --from', () => {
  const p = ab.plan({ tasks: 't5,t10', cells: 'new,control', reps: 2, from: 4 });
  assert.deepStrictEqual(p.map((r) => r.runId), ['t5-new-4', 't5-new-5', 't5-control-4', 't5-control-5', 't10-new-4', 't10-new-5', 't10-control-4', 't10-control-5']);
  assert.throws(() => ab.plan({ tasks: 't99' }), /unknown task/);
});

test('prepare: a tree from a git ref, a baseline repo per run, prompts that name the skill files', () => {
  const o = out();
  const list = ab.prepare({ new: 'HEAD', tasks: 't10', cells: 'new,control', reps: 1, out: o });
  assert.strictEqual(list.length, 2);
  assert.ok(fs.existsSync(path.join(o, 'trees', 'new', 'modules', 'tester', 'MODULE.md')));
  assert.ok(!fs.existsSync(path.join(o, 'trees', 'prev')), 'no tree for a cell not asked for');
  const [n, c] = list;
  assert.match(n.prompt, /^AB:t10-new-1\n/);
  assert.match(n.prompt, /trees\/new\/modules\/tester\/MODULE\.md/);
  assert.match(c.prompt, /No skill files/);
  assert.ok(fs.existsSync(path.join(n.dir, '.git')) && fs.existsSync(path.join(n.dir, 'server', 'schema.js')));
  assert.throws(() => ab.prepare({ tasks: 't10', cells: 'prev', reps: 1, out: o }), /--prev <ref> is required/);
});

test('grade: an untouched run fails each task, and the report says so', () => {
  const o = out();
  const list = ab.prepare({ new: 'HEAD', tasks: 't5,t8,t10', cells: 'new', reps: 1, out: o });
  const rows = list.map((r) => ({ ...r, u: { fresh: 1000, cacheRead: 0, turns: 1, tools: 0 }, g: ab.grade(r, r.dir, '', {}, path.join(o, 'work', `${r.runId}.snap.json`)) }));
  for (const r of rows) assert.strictEqual(r.g.pass, false, r.runId + ': ' + r.g.notes.join('; '));
  assert.match(rows[0].g.notes[1], /mutants killed 0\/3/);
  assert.match(rows[2].g.notes[1], /tests added false/);
  const rep = ab.report(rows, { new: 'HEAD' });
  assert.match(rep, /\| t10 \| new \| 0\/1 \|/);
});
