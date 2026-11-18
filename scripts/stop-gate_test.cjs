'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

const S = path.join(__dirname, 'stop-gate.cjs');
const git = (cwd, ...a) => cp.spawnSync('git', a, { cwd, encoding: 'utf8' });
// A repo with one commit and a linked worktree, like a worker's.
function repo() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mb-gate-'));
  const main = path.join(d, 'main'); fs.mkdirSync(main);
  git(main, 'init', '-q'); git(main, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'x');
  const wt = path.join(d, 'wt');
  git(main, 'worktree', 'add', '-q', wt);
  return { main, wt };
}
const hook = (cwd, input, ...a) => cp.spawnSync('node', [S, ...a], { cwd, input: JSON.stringify({ cwd, ...input }), encoding: 'utf8' });
const fail = 'node -e "console.error(\'Error: 2 tests failed\');process.exit(1)"';
const pass = 'node -e "process.exit(0)"';
const sid = () => 'test-' + Math.random().toString(36).slice(2);

test('a failing check in a worker worktree blocks the stop with the error lines', () => {
  const { wt } = repo();
  const r = hook(wt, { session_id: sid() }, '--cmd', fail);
  assert.strictEqual(r.status, 2);
  assert.match(r.stderr, /2 tests failed/);
  assert.match(r.stderr, /block 1 of 2/);
});

test('a passing check lets it stop; the main checkout is not gated unless --all', () => {
  const { main, wt } = repo();
  assert.strictEqual(hook(wt, { session_id: sid() }, '--cmd', pass).status, 0);
  assert.strictEqual(hook(main, { session_id: sid() }, '--cmd', fail).status, 0);
  assert.strictEqual(hook(main, { session_id: sid() }, '--cmd', fail, '--all').status, 2);
});

test('after --max blocks in a row it lets the chat stop instead of trapping it', () => {
  const { wt } = repo(); const s = sid();
  assert.strictEqual(hook(wt, { session_id: s }, '--cmd', fail).status, 2);
  assert.strictEqual(hook(wt, { session_id: s, stop_hook_active: true }, '--cmd', fail).status, 2);
  assert.strictEqual(hook(wt, { session_id: s, stop_hook_active: true }, '--cmd', fail).status, 0);
});

test('fails open: no --cmd, a missing command, bad stdin', () => {
  const { wt } = repo();
  assert.strictEqual(hook(wt, { session_id: sid() }).status, 0);
  assert.strictEqual(hook(wt, { session_id: sid() }, '--cmd', 'mb-no-such-test-cmd-xyz').status, 0);
  assert.strictEqual(cp.spawnSync('node', [S, '--cmd', fail], { cwd: wt, input: 'not json', encoding: 'utf8' }).status, 2);
  assert.strictEqual(cp.spawnSync('node', [S, '--cmd', fail], { cwd: os.tmpdir(), input: 'not json', encoding: 'utf8' }).status, 0);
});
