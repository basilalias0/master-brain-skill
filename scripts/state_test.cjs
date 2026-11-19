'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

test('summarises state and open board rows in 15 lines or fewer', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mb-st-'));
  fs.writeFileSync(path.join(d, 'STATE.md'), '# State\n\nIn flight: W1\n');
  fs.writeFileSync(path.join(d, 'BOARD.md'), '| Task | Status |\n|---|---|\n| a | done |\n| b | in-progress |\n| c | queued |\n');
  const out = cp.execFileSync('node', [path.join(__dirname, 'state.cjs'), d], { encoding: 'utf8' }).trim().split('\n');
  assert.ok(out.length <= 15);
  assert.ok(out.some((l) => /BOARD: 3 rows, 2 open/.test(l)));
  assert.ok(out.some((l) => /in-progress/.test(l)) && !out.some((l) => /\| a \|/.test(l)));
});

test('nudges after 8 new decision-log entries, counted by the highest DL number since the last review', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mb-st-'));
  const st = () => cp.execFileSync('node', [path.join(__dirname, 'state.cjs'), d], { encoding: 'utf8' });
  const dl = (ids) => fs.writeFileSync(path.join(d, 'ACTION_LOG.md'), '# ACTION_LOG\n\n## Entries\n' + ids.map((i) => `## DL-${String(i).padStart(3, '0')} — x\n`).join(''));
  fs.writeFileSync(path.join(d, 'STATE.md'), '# State\n');
  fs.mkdirSync(path.join(d, 'improve'));
  fs.writeFileSync(path.join(d, 'improve', 'last-run.json'), JSON.stringify({ entries: 0, dl: 4 }));
  dl([4, 5, 6, 7, 8, 9, 10, 11]);
  assert.doesNotMatch(st(), /Nudge/);
  dl([11, 12]); // older entries archived: the highest number still counts 8 new
  assert.match(st(), /Nudge: 8 decision-log entries logged since the last review/);
});

test('route-stats writes the decision-log marker that state reads', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mb-st-'));
  fs.writeFileSync(path.join(d, 'ACTION_LOG.md'), '## DL-007 — a\n## DL-012 — b\n');
  fs.writeFileSync(path.join(d, 'routing-log.jsonl'), '');
  cp.execFileSync('node', [path.join(__dirname, 'route-stats.cjs'), 'report', path.join(d, 'routing-log.jsonl'), '--write', path.join(d, 'improve', 'proposals')], { encoding: 'utf8' });
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(d, 'improve', 'last-run.json'), 'utf8')).dl, 12);
});
