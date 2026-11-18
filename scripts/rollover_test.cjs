'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

const S = path.join(__dirname, 'rollover.cjs');
const run = (...a) => cp.spawnSync('node', [S, ...a], { encoding: 'utf8' });

function project() {
  const md = fs.mkdtempSync(path.join(os.tmpdir(), 'mb-roll-'));
  fs.mkdirSync(path.join(md, 'masters'));
  fs.writeFileSync(path.join(md, 'BOARD.md'), `# BOARD
## Masters
| Master | Area | Session |
|---|---|---|
| M1 | billing | local_aaa |
| M2 | admin UI | local_bbb |

## Tasks
| id | task | status |
|---|---|---|
| W-M1-1 | tenants table | done |
| W-M1-2 | stripe plans | merged |
| W-M1-3 | metering | running |
| W-M2-1 | dashboard | blocked |
`);
  fs.writeFileSync(path.join(md, 'masters', 'C1.md'), `# C1
## LAST
- Waiting on the human: plan prices
- W-M1-1 tenants table done and merged
- Next: e2e sweep after W-M1-3
`);
  return md;
}

test('handoff keeps every Master and only open tasks, and drops finished items', () => {
  const md = project();
  const r = run('handoff', md);
  assert.strictEqual(r.status, 0, r.stderr);
  const out = fs.readFileSync(path.join(md, 'masters', 'C1-next.md'), 'utf8');
  assert.match(out, /local_aaa/); assert.match(out, /local_bbb/);
  assert.match(out, /W-M1-3/); assert.match(out, /W-M2-1/);
  assert.doesNotMatch(out, /W-M1-1|W-M1-2/);
  assert.match(out, /open: 2 of 4/);
  assert.match(out, /plan prices/); assert.match(out, /e2e sweep/);
  assert.ok(out.split('\n').length <= 61);
});

test('due says roll over at the point and keep below it', () => {
  assert.strictEqual(run('due', '260000').status, 0);
  assert.match(run('due', '260000').stdout, /roll over/);
  assert.strictEqual(run('due', '120000').status, 1);
  assert.strictEqual(run('due', '120000', '--at', '100000').status, 0);
  assert.strictEqual(run('due', 'x').status, 2);
});

test('a Master handoff keeps only its own open tasks and says to resume as that Master', () => {
  const md = project();
  run('handoff', md, '--chat', 'M2');
  const out = fs.readFileSync(path.join(md, 'masters', 'M2-next.md'), 'utf8');
  assert.match(out, /W-M2-1/); assert.doesNotMatch(out, /W-M1-3/);
  assert.match(out, /local_bbb/); assert.doesNotMatch(out, /local_aaa/);
  assert.match(out, /resume.*as M2/); assert.match(out, /BOARD Masters row for M2/);
});
