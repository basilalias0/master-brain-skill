'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

const S = path.join(__dirname, 'run-quiet.cjs');
const log = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mb-rq-')), 'out.log');

test('prints only the verdict and error lines, saves the full log', () => {
  const l = log();
  const r = cp.spawnSync('node', [S, '--log', l, '--', 'node', '-e', 'console.log("ok line");console.error("Error: boom");process.exit(3)'], { encoding: 'utf8' });
  assert.strictEqual(r.status, 3);
  assert.match(r.stdout, /exit=3/);
  assert.match(r.stdout, /boom/);
  assert.ok(!/ok line/.test(r.stdout));
  assert.match(fs.readFileSync(l, 'utf8'), /ok line/);
});

test('passing command exits 0 with a one-line verdict', () => {
  const l = log();
  const r = cp.spawnSync('node', [S, '--log', l, '--', 'node', '-e', 'console.log("fine")'], { encoding: 'utf8' });
  assert.strictEqual(r.status, 0);
  assert.strictEqual(r.stdout.trim().split('\n').length, 1);
});
