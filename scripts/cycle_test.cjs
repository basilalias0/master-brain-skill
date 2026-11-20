'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

const S = path.join(__dirname, 'cycle.cjs');
const run = (args) => cp.spawnSync('node', [S, ...args], { encoding: 'utf8' });
const dir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mb-cy-'));

test('not due, usage fine, room left: 8 lines or fewer, exit 0', () => {
  const r = run([dir(), '--ctx', '120000', '--week', '20', '--five', '10', '--tasks', '4:sup:active,2:sub:bg']);
  assert.strictEqual(r.status, 0, r.stderr);
  const out = r.stdout.trim().split('\n');
  assert.ok(out.length <= 8);
  assert.match(out[0], /rollover: not due \(context 120k < 250k\)/);
  assert.match(out[1], /arena allowed/);
  assert.ok(out.some((l) => /^capacity: load .* \/ 12/.test(l)) && out.some((l) => /^capacity: room/.test(l)));
});

test('rollover point comes from LAWS.md law 12; high usage is reported, still exit 0', () => {
  const d = dir();
  fs.writeFileSync(path.join(d, 'LAWS.md'), '12. **Context.** Chief and Masters roll over at `200k`.\n');
  const r = run([d, '--ctx', '210000', '--week', '92', '--role', 'chief']);
  assert.strictEqual(r.status, 0);
  assert.match(r.stdout, /rollover: DUE \(context 210k >= 200k\)/);
  assert.match(r.stdout, /stop launching/);
  assert.match(r.stdout, /5-hour not given/);
  assert.match(r.stdout, /chief limit 10/);
  assert.match(run([d, '--ctx', '210000', '--week', '1', '--at', '300000']).stdout, /not due/);
});

test('bad input exits 2', () => {
  assert.strictEqual(run([dir(), '--week', '5']).status, 2);
  assert.strictEqual(run([dir(), '--ctx', '5']).status, 2);
  assert.strictEqual(run([dir(), '--ctx', '5', '--week', '5', '--role', 'worker']).status, 2);
  assert.strictEqual(run([dir(), '--ctx', '5', '--week', '5', '--tasks', 'x:y:z']).status, 2);
});

test('when rollover is due, cycle names the method law 12 picks', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mb-cyc-p-'));
  const md = path.join(root, 'master-brain');
  fs.mkdirSync(md);
  fs.writeFileSync(path.join(md, 'BOARD.md'), '# BOARD\n## Masters\n| Master | Area |\n|---|---|\n| M1 | a |\n| M2 | b |\n| M3 | c |\n');
  const run = (...a) => cp.spawnSync('node', [path.join(__dirname, 'cycle.cjs'), md, ...a], { encoding: 'utf8' }).stdout;
  assert.match(run('--ctx', '260000', '--week', '10', '--role', 'chief'), /rollover method: new chat \(the reboot hook is not installed/);
  fs.mkdirSync(path.join(root, '.claude'));
  fs.writeFileSync(path.join(root, '.claude', 'settings.json'), '{"hooks":{"SessionStart":[{"matcher":"startup|clear","hooks":[{"type":"command","command":"node reboot.cjs hook"}]}]}}');
  const out = run('--ctx', '260000', '--week', '10', '--role', 'chief');
  assert.match(out, /rollover method: clear in place \(not more tokens;.*3 peers.*handoff <master_dir> --chat C1 --mark/);
  assert.ok(out.trim().split('\n').length <= 8);
  assert.match(run('--ctx', '100000', '--week', '10', '--role', 'chief'), /rollover: not due/);
});
