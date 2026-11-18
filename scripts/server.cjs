#!/usr/bin/env node
'use strict';
// server.cjs: dev servers the skill starts, and only those, get stopped after use (owner, 2026-11-18). Zero model tokens.
//   start <master_dir> --name N --port P [--cwd DIR] [--wait SEC] -- <command...>   start detached, log to servers/N.log,
//                                     record it, wait until the port answers (default 90 s)
//   register <master_dir> --name N --pid PID [--port P]   record a server started another way (background task, worker)
//   list <master_dir>                 recorded servers, alive or not; forgets dead ones
//   stop <master_dir> <name>|--all    stop the whole process tree (pnpm -> vite), check the port is free, forget it
// Never stops a process it did not record: the record holds the pid and its image name, and both must still match.
// Browser-pane previews are not here: stop those with preview_stop. Exit: 0 ok, 1 not ready / still listening, 2 usage.
const fs = require('fs');
const net = require('net');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const win = process.platform === 'win32';
const dirOf = (md) => path.join(md, 'servers');
const recFile = (md, name) => path.join(dirOf(md), String(name).replace(/[^\w.-]/g, '_') + '.json');

function image(pid) {
  if (!pid) return null;
  if (win) {
    const r = spawnSync('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], { encoding: 'utf8' });
    const m = /^"([^"]+)","(\d+)"/m.exec(r.stdout || '');
    return m && Number(m[2]) === Number(pid) ? m[1].toLowerCase() : null;
  }
  const r = spawnSync('ps', ['-p', String(pid), '-o', 'comm='], { encoding: 'utf8' });
  return r.status === 0 && r.stdout.trim() ? path.basename(r.stdout.trim()).toLowerCase() : null;
}

const listening = (port) => new Promise((res) => {
  if (!port) return res(false);
  const s = net.connect({ port: Number(port), host: '127.0.0.1' });
  const done = (v) => { s.destroy(); res(v); };
  s.setTimeout(800, () => done(false));
  s.once('connect', () => done(true));
  s.once('error', () => done(false));
});

async function waitPort(port, sec, wantOpen) {
  for (const end = Date.now() + sec * 1000; Date.now() < end;) {
    if ((await listening(port)) === wantOpen) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return (await listening(port)) === wantOpen;
}

function records(md) {
  const d = dirOf(md);
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d).filter((f) => f.endsWith('.json')).map((f) => {
    try { return JSON.parse(fs.readFileSync(path.join(d, f), 'utf8')); } catch { return null; }
  }).filter(Boolean);
}

function save(md, rec) {
  fs.mkdirSync(dirOf(md), { recursive: true });
  fs.writeFileSync(recFile(md, rec.name), JSON.stringify(rec, null, 2));
}

// The pid is ours only while it runs the same image it ran when recorded; a reused pid is someone else's process.
const ours = (rec) => !!rec.pid && image(rec.pid) === rec.image;

async function start(md, o, cmd) {
  if (!o.name || !cmd.length) throw new Error('start needs --name and -- <command>');
  const old = records(md).find((r) => r.name === o.name);
  if (old && ours(old)) return { ok: true, note: `already running (pid ${old.pid})`, rec: old };
  if (o.port && (await listening(o.port))) throw new Error(`port ${o.port} is already in use by a server this skill did not start`);
  fs.mkdirSync(dirOf(md), { recursive: true });
  const log = path.join(dirOf(md), o.name + '.log');
  const fd = fs.openSync(log, 'a');
  // A shell resolves Windows .cmd shims (npm, pnpm); detached gives it its own process group to stop as one.
  const line = cmd.map((a) => (/[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a)).join(' ');
  const child = spawn(line, { cwd: o.cwd || process.cwd(), shell: true, detached: true, stdio: ['ignore', fd, fd], windowsHide: true });
  child.unref();
  fs.closeSync(fd);
  const rec = { name: o.name, pid: child.pid, image: image(child.pid), port: o.port || null, cmd: line, cwd: o.cwd || process.cwd(), log, started: new Date().toISOString() };
  save(md, rec);
  if (!o.port) return { ok: true, rec };
  const up = await waitPort(o.port, Number(o.wait || 90), true);
  return { ok: up, rec, note: up ? `port ${o.port} answers` : `port ${o.port} did not answer in ${o.wait || 90}s; see ${log}` };
}

function register(md, o) {
  if (!o.name || !o.pid) throw new Error('register needs --name and --pid');
  const img = image(o.pid);
  if (!img) throw new Error(`no process ${o.pid}`);
  const rec = { name: o.name, pid: Number(o.pid), image: img, port: o.port || null, cmd: '(registered)', started: new Date().toISOString() };
  save(md, rec);
  return rec;
}

async function stop(md, rec) {
  if (ours(rec)) {
    if (win) spawnSync('taskkill', ['/PID', String(rec.pid), '/T', '/F'], { stdio: 'ignore' });
    else { try { process.kill(-rec.pid, 'SIGTERM'); } catch { try { process.kill(rec.pid, 'SIGTERM'); } catch {} } }
  }
  const free = rec.port ? await waitPort(rec.port, 10, false) : true;
  if (!win && !free && ours(rec)) { try { process.kill(-rec.pid, 'SIGKILL'); } catch {} }
  fs.rmSync(recFile(md, rec.name), { force: true });
  return { name: rec.name, free: free || (rec.port ? await waitPort(rec.port, 3, false) : true) };
}

async function list(md) {
  const out = [];
  for (const r of records(md)) {
    const alive = ours(r);
    if (!alive) { fs.rmSync(recFile(md, r.name), { force: true }); continue; }
    out.push({ ...r, listening: await listening(r.port) });
  }
  return out;
}

function args(argv) {
  const split = argv.indexOf('--');
  const head = split < 0 ? argv : argv.slice(0, split);
  const o = { _: [], cmd: split < 0 ? [] : argv.slice(split + 1) };
  for (let i = 0; i < head.length; i++) {
    if (head[i] === '--all') o.all = true;
    else if (head[i].startsWith('--')) o[head[i].slice(2)] = head[++i];
    else o._.push(head[i]);
  }
  return o;
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const o = args(rest);
  const md = o._[0];
  if (!cmd || !md) { console.error('usage: server.cjs start|register|list|stop <master_dir> ... (see the header)'); return 2; }
  if (cmd === 'start') {
    const r = await start(md, o, o.cmd);
    console.log(`${r.rec.name}: pid ${r.rec.pid}${r.note ? ', ' + r.note : ''}; log ${r.rec.log || 'none'}`);
    return r.ok ? 0 : 1;
  }
  if (cmd === 'register') { const r = register(md, o); console.log(`${r.name}: pid ${r.pid} (${r.image}) recorded`); return 0; }
  if (cmd === 'list') {
    const rs = await list(md);
    if (!rs.length) console.log('servers: none running');
    rs.forEach((r) => console.log(`${r.name}: pid ${r.pid}, port ${r.port || '-'} ${r.listening ? 'answering' : 'not answering'}, since ${r.started}`));
    return 0;
  }
  if (cmd === 'stop') {
    const want = o.all ? records(md) : records(md).filter((r) => r.name === o._[1]);
    if (!o.all && !want.length) { console.log(`server ${o._[1]}: not recorded, nothing stopped`); return 0; }
    let bad = 0;
    for (const r of want) { const s = await stop(md, r); if (!s.free) bad++; console.log(`${s.name}: stopped${s.free ? '' : `, but port ${r.port} still answers`}`); }
    if (!want.length) console.log('servers: none recorded');
    return bad ? 1 : 0;
  }
  console.error(`unknown command ${cmd}`);
  return 2;
}

if (require.main === module) main().then((c) => process.exit(c), (e) => { console.error(String(e.message || e)); process.exit(2); });

// Sync check for boot (capacity.cjs check): recorded servers whose process still runs.
const alive = (md) => records(md).filter(ours);

module.exports = { records, list, alive, image, listening };
