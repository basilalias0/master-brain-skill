'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const { digest } = require('./law-lint.cjs');

const S = path.join(__dirname, 'boot.cjs');
const env = { ...process.env, MB_SPEC: '{"ramGB":16,"cores":8,"host":"t"}' };
const run = (args) => cp.spawnSync('node', [S, ...args], { encoding: 'utf8', env });

function project(masters = ['M1']) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mb-boot-'));
  fs.writeFileSync(path.join(d, 'LAWS.md'), '# LAWS\n## The laws\n1. **One.** Rule one.\n');
  digest(path.join(d, 'LAWS.md'), path.join(d, 'LAWS_DIGEST.md'));
  fs.writeFileSync(path.join(d, 'STATE.md'), '# State\nIn flight: W-M1-1\n');
  fs.writeFileSync(path.join(d, 'BOARD.md'), '| Task | Status |\n|---|---|\n| a | done |\n| b | in-progress |\n');
  fs.mkdirSync(path.join(d, 'masters'));
  fs.writeFileSync(path.join(d, 'masters', 'C1.md'), '# C1\n## LAST\n- chief open item\n## 2026\nold\n');
  for (const m of masters) fs.writeFileSync(path.join(d, 'masters', m + '.md'), `# ${m}\n## LAST\n- ${m} next: fix login\n- ${m} merged a\n## older\n- not shown\n`);
  return d;
}

test('master boot: digest, capacity, snapshot and only its own LAST block, 25 lines or fewer', () => {
  const d = project(['M1', 'M2']);
  const r = run([d, '--self', 'M2']);
  assert.strictEqual(r.status, 0, r.stderr);
  const out = r.stdout.trim().split('\n');
  assert.ok(out.length <= 25);
  assert.match(out[0], /digest ok/);
  assert.ok(out.some((l) => /calibrated/.test(l)), 'capacity check ran');
  assert.ok(out.some((l) => /BOARD: 2 rows, 1 open/.test(l)), 'snapshot ran');
  assert.ok(out.some((l) => /M2 next: fix login/.test(l)));
  assert.ok(!out.some((l) => /M1 next|not shown|chief open/.test(l)));
});

test('several Masters without --self asks for it; a single Master is found alone', () => {
  assert.match(run([project(['M1', 'M2'])]).stdout, /several Masters \(M1, M2\)/);
  assert.match(run([project(['M1'])]).stdout, /LAST M1:/);
});

test('chief boot shows every LAST block; a stale digest exits 1', () => {
  const d = project(['M1', 'M2', 'M3']);
  const out = run([d, '--role', 'chief']).stdout;
  for (const id of ['C1', 'M1', 'M2', 'M3']) assert.match(out, new RegExp(`LAST ${id}:`));
  assert.ok(out.trim().split('\n').length <= 25);
  fs.appendFileSync(path.join(d, 'LAWS.md'), '2. **Two.** Changed.\n');
  const r = run([d, '--role', 'chief']);
  assert.strictEqual(r.status, 1);
  assert.match(r.stdout, /digest STALE/);
});

test('the improve nudge shows; bad input exits 2', () => {
  const d = project();
  fs.writeFileSync(path.join(d, 'routing-log.jsonl'), '{}\n'.repeat(11));
  assert.match(run([d]).stdout, /Nudge: 11 tasks logged/);
  assert.strictEqual(run([path.join(d, 'nope')]).status, 2);
  assert.strictEqual(run([d, '--role', 'boss']).status, 2);
});
