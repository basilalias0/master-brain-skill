'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const r = require('./reboot.cjs');

const S = path.join(__dirname, 'reboot.cjs');
function project(handoff = '# C1 handoff\nopen: W-M1-3 review\n') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mb-rb-'));
  const m = path.join(root, 'master-brain');
  fs.mkdirSync(path.join(m, 'masters'), { recursive: true });
  fs.writeFileSync(path.join(m, 'STATE.md'), '# State\n');
  if (handoff !== null) fs.writeFileSync(path.join(m, 'masters', 'C1-next.md'), handoff);
  const sub = path.join(root, 'app', 'src');
  fs.mkdirSync(sub, { recursive: true });
  return { root, m, sub };
}
// The app passes its own session id to hooks as CLAUDE_CODE_HOST_SESSION_ID; tests set it, never inherit it.
const runHook = (input, host = '') => cp.spawnSync('node', [S, 'hook'], { input, encoding: 'utf8', env: { ...process.env, CLAUDE_CODE_HOST_SESSION_ID: host } });

test('mark needs the handoff and a valid chat', () => {
  assert.throws(() => r.mark(project(null).m), /no handoff/);
  assert.throws(() => r.mark(project().m, { chat: 'W1' }), /C1 or M<n>/);
  const p = project();
  const f = r.mark(p.m, { session: 's-1' });
  assert.deepStrictEqual(Object.keys(JSON.parse(fs.readFileSync(f, 'utf8'))), ['chat', 'session', 'at']);
});

test('the app restart after a clear (source startup) boots the marked chat once, then a later start is normal', () => {
  const p = project();
  r.mark(p.m, { session: 'local_a' });
  const start = JSON.stringify({ source: 'startup', cwd: p.sub, session_id: 'new-internal-id' });
  const out = runHook(start, 'local_a');
  assert.strictEqual(out.status, 0);
  const ctx = JSON.parse(out.stdout).hookSpecificOutput;
  assert.strictEqual(ctx.hookEventName, 'SessionStart');
  assert.match(ctx.additionalContext, /rollover of the Chief \(C1\)[\s\S]*argument `chief`[\s\S]*open: W-M1-3 review/);
  assert.ok(fs.existsSync(path.join(p.m, 'masters', '.reboot.used')));
  assert.strictEqual(runHook(start, 'local_a').stdout, '');
});

test('the hook says nothing for other chats, other start kinds, stale markers or bad input', () => {
  const p = project();
  r.mark(p.m, { session: 'local_a' });
  assert.strictEqual(runHook(JSON.stringify({ source: 'startup', cwd: p.sub }), 'local_b').stdout, '', 'another chat in the project');
  assert.strictEqual(runHook(JSON.stringify({ source: 'resume', cwd: p.sub }), 'local_a').stdout, '');
  assert.strictEqual(runHook(JSON.stringify({ source: 'compact', cwd: p.sub }), 'local_a').stdout, '');
  assert.strictEqual(runHook('not json', 'local_a').stdout, '');
  assert.strictEqual(runHook(JSON.stringify({ source: 'startup', cwd: os.tmpdir() }), 'local_a').stdout, '');
  assert.ok(fs.existsSync(path.join(p.m, 'masters', '.reboot')), 'unrelated starts leave the marker');
  assert.strictEqual(r.hook(JSON.stringify({ source: 'startup', cwd: p.sub }), { now: Date.now() + 31 * 60e3, hostId: 'local_a' }), '');
  assert.ok(fs.existsSync(path.join(p.m, 'masters', '.reboot.stale')));
});

test('an unnamed marker fires only on a startup within 5 minutes, or on a /clear within 30', () => {
  const p = project();
  r.mark(p.m);
  const start = JSON.stringify({ source: 'startup', cwd: p.sub });
  assert.strictEqual(r.hook(start, { now: Date.now() + 6 * 60e3, hostId: 'local_x' }), '', 'a chat opened later is not the Chief');
  assert.notStrictEqual(r.hook(JSON.stringify({ source: 'clear', cwd: p.sub }), { now: Date.now() + 6 * 60e3, hostId: 'local_x' }), '');
});

test('--log writes the source and the app session id only, never the environment', () => {
  const p = project();
  const log = path.join(p.root, 'hook.log');
  const res = cp.spawnSync('node', [S, 'hook', '--log', log], { input: JSON.stringify({ source: 'startup', cwd: p.sub }), encoding: 'utf8', env: { ...process.env, CLAUDE_CODE_HOST_SESSION_ID: 'local_q', CLAUDE_CODE_USER_EMAIL: 'x@example.com' } });
  assert.strictEqual(res.status, 0);
  const line = JSON.parse(fs.readFileSync(log, 'utf8').trim());
  assert.deepStrictEqual(Object.keys(line), ['at', 'source', 'host', 'fired']);
  assert.ok(line.source === 'startup' && line.host === 'local_q' && line.fired === false);
  assert.doesNotMatch(fs.readFileSync(log, 'utf8'), /example\.com/);
});

test('a Master marker boots that Master, and a long handoff stays under the context cap', () => {
  const p = project();
  fs.writeFileSync(path.join(p.m, 'masters', 'M3-next.md'), 'x'.repeat(20000));
  r.mark(p.m, { chat: 'M3' });
  const ctx = r.hook(JSON.stringify({ source: 'clear', cwd: p.root }));
  const text = JSON.parse(ctx).hookSpecificOutput.additionalContext;
  assert.match(text, /Master M3[\s\S]*--self M3/);
  assert.ok(text.length <= 9500 && /handoff cut at/.test(text));
});
