#!/usr/bin/env node
'use strict';
// drift.cjs check <dir> [--today YYYY-MM-DD] [--max-lines 5] [--max-days 14] [--strict]
// drift.cjs hash <spec.md>   prints the body_sha256 to record when the owner locks a spec
// A locked spec (procedure/04) has, near the top, `Status: LOCKED YYYY-MM-DD` and `body_sha256: <hex>`.
// Body = the lines after the body_sha256 line, up to the `## Change log` heading, trimmed. After the lock only change lines
// are added under `## Change log`, each `- YYYY-MM-DD CL-<n>: <text>`; a fold is marked `<!-- folded YYYY-MM-DD -->`.
// Per locked spec: change lines since the last fold marker, their oldest date, `fold due` at >= max-lines lines or
// >= max-days days, and `body edited after lock` on a hash mismatch. Specs without the LOCKED line are skipped.
// Exit: 0 report; 1 with --strict when anything is flagged; 2 on a malformed line or date, or unreadable input.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const LOCK = /^Status: LOCKED (\d{4}-\d{2}-\d{2})\s*$/;
const HASH = /^body_sha256: ([0-9a-f]{64})\s*$/;
const CHANGE = /^- (\d{4}-\d{2}-\d{2}) CL-\d+: \S/;
const FOLD = /^<!-- folded (\d{4}-\d{2}-\d{2}) -->$/;
const HEAD_LINES = 10;

class Malformed extends Error {}

function day(s, where) {
  const t = Date.parse(s + 'T00:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== s) throw new Malformed(`${where}: bad date ${s}`);
  return t;
}

function parse(text, where) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const li = lines.slice(0, HEAD_LINES).findIndex((l) => LOCK.test(l));
  if (li < 0) return { locked: false };
  day(LOCK.exec(lines[li])[1], where);
  const hi = lines.slice(0, HEAD_LINES).findIndex((l) => HASH.test(l));
  if (hi < 0) throw new Malformed(`${where}: LOCKED but no body_sha256 line`);
  const ci = lines.findIndex((l) => /^## Change log\s*$/.test(l));
  const end = ci < 0 ? lines.length : ci;
  const body = lines.slice(hi + 1, end).join('\n').trim();
  const changes = [];
  let since = [];
  if (ci >= 0) {
    for (let i = ci + 1; i < lines.length; i++) {
      const l = lines[i].trim();
      if (/^## /.test(l)) break;
      if (!l) continue;
      const f = FOLD.exec(l);
      if (f) { day(f[1], `${where}:${i + 1}`); since = []; continue; }
      const c = CHANGE.exec(l);
      if (!c) throw new Malformed(`${where}:${i + 1}: malformed change line (want "- YYYY-MM-DD CL-<n>: <text>")`);
      const d = { date: c[1], t: day(c[1], `${where}:${i + 1}`) };
      changes.push(d); since.push(d);
    }
  }
  return { locked: true, hash: HASH.exec(lines[hi])[1], body, changes, since };
}

const bodyHash = (body) => crypto.createHash('sha256').update(body).digest('hex');

function specs(dir) {
  const out = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === '.git' || e.name === 'node_modules') continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p); else if (/\.md$/.test(e.name)) out.push(p);
    }
  })(dir);
  return out.sort();
}

function check(dir, o = {}) {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) throw new Malformed('not a folder: ' + dir);
  const maxLines = o.maxLines || 5;
  const maxDays = o.maxDays || 14;
  const today = day(o.today || new Date().toISOString().slice(0, 10), '--today');
  const report = [];
  let flagged = false;
  for (const f of specs(dir)) {
    const rel = path.relative(dir, f).replace(/\\/g, '/');
    const s = parse(fs.readFileSync(f, 'utf8'), rel);
    if (!s.locked) { report.push(`${rel}: unlocked, skipped`); continue; }
    const oldest = s.since.length ? s.since.reduce((a, b) => (b.t < a.t ? b : a)) : null;
    const flags = [];
    if (s.since.length >= maxLines || (oldest && (today - oldest.t) / 86400000 >= maxDays)) flags.push('fold due');
    if (bodyHash(s.body) !== s.hash) flags.push('body edited after lock');
    if (flags.length) flagged = true;
    report.push(`${rel}: ${s.since.length} change lines since last fold${oldest ? ', oldest ' + oldest.date : ''}${flags.length ? '; ' + flags.join('; ') : ''}`);
  }
  return { report, flagged };
}

function hashFile(f) {
  const lines = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n').split('\n');
  const hi = lines.slice(0, HEAD_LINES).findIndex((l) => /^body_sha256:/.test(l));
  if (hi < 0) throw new Malformed(`${f}: add a "body_sha256: " line near the top first`);
  const ci = lines.findIndex((l) => /^## Change log\s*$/.test(l));
  return bodyHash(lines.slice(hi + 1, ci < 0 ? lines.length : ci).join('\n').trim());
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const flag = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
  try {
    if (argv[0] === 'hash' && argv[1]) { console.log(hashFile(argv[1])); process.exit(0); }
    if (argv[0] !== 'check' || !argv[1]) { console.error('usage: drift.cjs check <dir> [--today D] [--max-lines 5] [--max-days 14] [--strict] | hash <spec.md>'); process.exit(2); }
    const r = check(argv[1], { today: flag('--today'), maxLines: Number(flag('--max-lines')) || 5, maxDays: Number(flag('--max-days')) || 14 });
    console.log(r.report.length ? r.report.join('\n') : 'no specs');
    process.exit(r.flagged && argv.includes('--strict') ? 1 : 0);
  } catch (e) {
    console.error('drift: ' + e.message);
    process.exit(2);
  }
}

module.exports = { check, parse, bodyHash, hashFile };
