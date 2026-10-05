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
