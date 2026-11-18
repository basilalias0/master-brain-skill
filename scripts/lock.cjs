#!/usr/bin/env node
'use strict';
// lock.cjs acquire|release|status <name> [--owner X] [--ttl SEC] [--dir DIR] [--force]
// Atomic mkdir locks (heavy slot, schema lock, lane claims). Exit: 0 ok, 1 busy or not held, 2 usage.
const fs = require('fs');
const path = require('path');

const dirOf = (dir, name) => path.join(dir, String(name).replace(/[^\w.-]/g, '_'));
const GRACE = 10e3; // ms a fresh folder may lack its owner file, and a reclaim guard may live
const age = (d) => { try { return Date.now() - fs.statSync(d).mtimeMs; } catch { return Infinity; } };
const meta = (owner, ttl) => JSON.stringify({ owner, time: Date.now(), expires: Date.now() + ttl * 1000 });

function read(d) {
  try {
    const m = JSON.parse(fs.readFileSync(path.join(d, 'owner.json'), 'utf8'));
    m.expired = Date.now() > m.expires;
    return m;
  } catch {
    // No owner file: either another process is between mkdir and write, or a crash left it. Only the old one is stale.
    return fs.existsSync(d) ? { owner: '?', expired: age(d) > GRACE, corrupt: true } : null;
  }
}

function acquire(dir, name, owner, ttl) {
  fs.mkdirSync(dir, { recursive: true });
  const d = dirOf(dir, name);
  for (let i = 0; i < 3; i++) {
    try {
      fs.mkdirSync(d);
      fs.writeFileSync(path.join(d, 'owner.json'), meta(owner, ttl));
      return { ok: true };
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      const s = read(d);
      if (s && s.owner === owner && !s.corrupt) {
        fs.writeFileSync(path.join(d, 'owner.json'), meta(owner, ttl));
        return { ok: true, refreshed: true };
      }
      if (!s) continue;
      if (s.expired && reclaim(d)) continue;
      return { ok: false, holder: s };
    }
  }
  return { ok: false };
}

// Two contenders that both saw a stale lock would each delete it, and the later delete removes the other's new lock.
// A guard folder lets one reclaim at a time, and the lock is read again under the guard before it is removed.
function reclaim(d) {
  const g = d + '.steal';
  try { fs.mkdirSync(g); } catch (e) {
    if (e.code !== 'EEXIST') throw e;
    if (age(g) > GRACE) fs.rmSync(g, { recursive: true, force: true });
    return false;
  }
  try {
    const s = read(d);
    if (s && s.expired) fs.rmSync(d, { recursive: true, force: true });
    return true;
  } finally { fs.rmSync(g, { recursive: true, force: true }); }
}

function release(dir, name, owner, force) {
  const d = dirOf(dir, name);
  const s = read(d);
  if (!s) return { ok: true, note: 'free' };
  if (!force && s.owner !== owner) return { ok: false, holder: s };
  fs.rmSync(d, { recursive: true, force: true });
  return { ok: true };
}

function parse(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--force') o.force = true;
    else if (a.startsWith('--')) o[a.slice(2)] = argv[++i];
    else o._.push(a);
  }
  return o;
}

if (require.main === module) {
  const o = parse(process.argv.slice(2));
  const [cmd, name] = o._;
  const dir = o.dir || process.env.MB_LOCK_DIR || path.join(process.cwd(), 'locks');
  const owner = o.owner || 'unknown';
  if (!cmd || !name) { console.error('usage: lock.cjs acquire|release|status <name> [--owner X] [--ttl SEC] [--dir DIR] [--force]'); process.exit(2); }
  let r;
  if (cmd === 'acquire') r = acquire(dir, name, owner, Number(o.ttl || 3600));
  else if (cmd === 'release') r = release(dir, name, owner, o.force);
  else if (cmd === 'status') { const s = read(dirOf(dir, name)); console.log(s ? JSON.stringify(s) : 'free'); process.exit(0); }
  else { console.error('unknown command ' + cmd); process.exit(2); }
  console.log(JSON.stringify(r));
  process.exit(r.ok ? 0 : 1);
}

module.exports = { acquire, release, read, dirOf };
