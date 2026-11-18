'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const { DIRS, FILES } = require('./init.cjs');

const S = path.join(__dirname, 'init.cjs');
const run = (args) => cp.spawnSync('node', [S, ...args], { encoding: 'utf8' });

test('seeds every onboarding file and folder, copies the templates', () => {
  const d = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mb-init-')), 'master-brain');
  const r = run([d]);
  assert.strictEqual(r.status, 0, r.stderr);
  for (const x of DIRS) assert.ok(fs.statSync(path.join(d, x)).isDirectory(), x);
  for (const f of Object.keys(FILES)) assert.ok(fs.existsSync(path.join(d, f)), f);
  assert.ok(fs.existsSync(path.join(d, 'overlay', 'base.json')));
  assert.match(fs.readFileSync(path.join(d, 'BOARD.md'), 'utf8'), /## Masters\n\| Master \|/);
  const tpl = (f) => fs.readFileSync(path.join(__dirname, '..', 'templates', f), 'utf8');
  assert.strictEqual(fs.readFileSync(path.join(d, 'MODELS.md'), 'utf8'), tpl('MODELS.md'));
  assert.strictEqual(fs.readFileSync(path.join(d, 'ACTION_LOG.md'), 'utf8'), tpl('ACTION_LOG.md'));
  assert.strictEqual(fs.readFileSync(path.join(d, 'routing-log.jsonl'), 'utf8'), '');
  assert.ok(!fs.existsSync(path.join(d, 'LAWS.md')), 'LAWS.md is filled with the human, not seeded');
});

test('idempotent: a second run overwrites nothing', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mb-init-'));
  run([d]);
  fs.writeFileSync(path.join(d, 'STATE.md'), 'mine\n');
  const r = run([d]);
  assert.strictEqual(r.status, 0);
  assert.match(r.stdout, /nothing to create/);
  assert.strictEqual(fs.readFileSync(path.join(d, 'STATE.md'), 'utf8'), 'mine\n');
  assert.strictEqual(run([]).status, 2);
});
