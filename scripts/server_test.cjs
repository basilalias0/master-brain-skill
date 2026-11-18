'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const cp = require('child_process');
const { listening, image } = require('./server.cjs');

const S = path.join(__dirname, 'server.cjs');
const md = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mb-srv-'));
const run = (...a) => cp.spawnSync('node', [S, ...a], { encoding: 'utf8' });
const freePort = () => new Promise((res) => { const s = net.createServer().listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });
// A parent that starts a child server, like pnpm starting vite: stopping must take the whole tree.
const tree = (port) => `const cp=require('child_process');cp.spawn(process.execPath,['-e','require("http").createServer((q,s)=>s.end("ok")).listen(${port})'],{stdio:'inherit'});setInterval(()=>{},1e3)`;

test('start waits for the port, list shows it, stop frees the port and forgets it', async () => {
  const d = md(); const port = await freePort();
  const s = run('start', d, '--name', 'web', '--port', String(port), '--wait', '20', '--', 'node', '-e', tree(port));
  assert.strictEqual(s.status, 0, s.stdout + s.stderr);
  assert.ok(await listening(port));
  assert.match(run('list', d).stdout, new RegExp(`web: pid \\d+, port ${port} answering`));
  const t = run('stop', d, 'web');
  assert.strictEqual(t.status, 0, t.stdout);
  assert.match(t.stdout, /web: stopped$/m);
  assert.strictEqual(await listening(port), false, 'child server must be gone too');
  assert.match(run('list', d).stdout, /none running/);
});

test('a port taken by something else is refused, never adopted', async () => {
  const d = md(); const port = await freePort();
  const other = net.createServer().listen(port);
  await new Promise((r) => other.once('listening', r));
  const s = run('start', d, '--name', 'web', '--port', String(port), '--', 'node', '-e', 'setInterval(()=>{},1e3)');
  assert.strictEqual(s.status, 2);
  assert.match(s.stderr, /already in use/);
  other.close();
});

test('stop never kills a pid whose image changed (pid reuse), and stop of an unknown name is a no-op', async () => {
  const d = md();
  const victim = cp.spawn(process.execPath, ['-e', 'setInterval(()=>{},1e3)'], { stdio: 'ignore' });
  fs.mkdirSync(path.join(d, 'servers'), { recursive: true });
  fs.writeFileSync(path.join(d, 'servers', 'old.json'), JSON.stringify({ name: 'old', pid: victim.pid, image: 'not-this-image.exe', port: null }));
  assert.strictEqual(run('stop', d, '--all').status, 0);
  assert.ok(image(victim.pid), 'the unrelated process must still run');
  victim.kill();
  assert.match(run('stop', d, 'nope').stdout, /not recorded, nothing stopped/);
});

test('register records a running process; list forgets dead ones', async () => {
  const d = md();
  const p = cp.spawn(process.execPath, ['-e', 'setInterval(()=>{},1e3)'], { stdio: 'ignore' });
  assert.strictEqual(run('register', d, '--name', 'bg', '--pid', String(p.pid)).status, 0);
  assert.match(run('list', d).stdout, /bg: pid/);
  p.kill();
  await new Promise((r) => p.once('exit', r));
  assert.match(run('list', d).stdout, /none running/);
  assert.strictEqual(fs.readdirSync(path.join(d, 'servers')).filter((f) => f.endsWith('.json')).length, 0);
});

test('boot (capacity.cjs check) names servers left running', async () => {
  const d = md();
  const p = cp.spawn(process.execPath, ['-e', 'setInterval(()=>{},1e3)'], { stdio: 'ignore' });
  run('register', d, '--name', 'left', '--pid', String(p.pid), '--port', '5999');
  const r = cp.spawnSync('node', [path.join(__dirname, 'capacity.cjs'), 'check', d], { encoding: 'utf8' });
  p.kill();
  assert.match(r.stdout, /servers still running: left :5999/);
});
