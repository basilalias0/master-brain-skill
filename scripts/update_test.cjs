'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { run } = require('./update.cjs');

const g = (cwd, ...a) => { const r = spawnSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', '-c', 'core.autocrlf=false', ...a], { cwd, encoding: 'utf8' }); assert.strictEqual(r.status, 0, r.stderr); return r.stdout; };

function setup() {
  const t = fs.mkdtempSync(path.join(os.tmpdir(), 'mb-up-'));
  const bare = path.join(t, 'remote.git');
  const work = path.join(t, 'work');
  const user = path.join(t, 'user');
  g(t, 'init', '--bare', '-b', 'main', bare);
  g(t, 'clone', '-q', bare, work);
  fs.writeFileSync(path.join(work, 'VERSION'), '1.0.0\n');
  g(work, 'add', '-A'); g(work, 'commit', '-qm', 'one'); g(work, 'push', '-q', 'origin', 'HEAD:main');
  g(t, 'clone', '-q', bare, user);
  return { t, work, user, dir: path.join(t, 'mb') };
}
const release = (work) => { fs.writeFileSync(path.join(work, 'VERSION'), '1.1.0\n'); g(work, 'commit', '-qam', 'two'); g(work, 'push', '-q', 'origin', 'HEAD:main'); };

test('up to date: nothing to do', () => {
  const s = setup();
  assert.match(run(s.user, s.dir, true).text, /already up to date/);
});

test('without --yes it only shows the plan; with --yes it fast-forwards and rebases the overlay', () => {
  const s = setup();
  release(s.work);
  const dry = run(s.user, s.dir, false);
  assert.match(dry.text, /1 new commit/);
  assert.strictEqual(fs.readFileSync(path.join(s.user, 'VERSION'), 'utf8').trim(), '1.0.0');
  const real = run(s.user, s.dir, true);
  assert.strictEqual(real.code, 0);
  assert.strictEqual(fs.readFileSync(path.join(s.user, 'VERSION'), 'utf8').trim(), '1.1.0');
  assert.match(fs.readFileSync(path.join(s.dir, 'overlay', 'base.json'), 'utf8'), /1\.1\.0/);
});

test('local edits block the update; a diverged history is not merged', () => {
  const s = setup();
  release(s.work);
  fs.writeFileSync(path.join(s.user, 'VERSION'), 'edited\n');
  const r = run(s.user, s.dir, true);
  assert.strictEqual(r.code, 1);
  assert.match(r.text, /local edits/);
  g(s.user, 'checkout', '--', 'VERSION');
  fs.writeFileSync(path.join(s.user, 'extra.txt'), 'x'); g(s.user, 'add', '-A'); g(s.user, 'commit', '-qm', 'local');
  const d = run(s.user, s.dir, true);
  assert.strictEqual(d.code, 1);
  assert.match(d.text, /fast-forward not possible/);
});
