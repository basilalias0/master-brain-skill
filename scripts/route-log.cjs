#!/usr/bin/env node
'use strict';
// route-log.cjs append --log FILE --task TYPE --start T1 --result pass|fail [--final T2] [--tokens N]
//                      [--rework yes|no] [--correction yes|no] [--size S|M|L|XL] [--pct N] [--worker sub|chat --boot N] [--note TEXT]
// route-log.cjs from-result <RESULT file> --log FILE --task TYPE --start T1 [--size S] [--pct N] [any append flag]
//   Reads the first RESULT block in the file (core/RESULT.md; a handoff's LAST block is on top): status done = pass,
//   else fail; needs-master or test-guard violations = rework yes; the note is the commit and gates. Flags win.
// --size and --pct (the 5-hour window % this task used, get_usage before and after) calibrate scripts/scale.cjs.
// Appends one JSON line per finished task. It only records; the routing table is never edited from here.
// Task TYPE is a short key from the routing table (e.g. lookup, plan, bugfix). Never put secrets in --note.
const fs = require('fs');
const path = require('path');

const TIERS = ['T0', 'T1', 'T2', 'T3'];
const yn = (v) => (v === 'yes' ? true : v === 'no' || v === undefined ? false : null);

function build(o) {
  const err = (m) => { throw new Error(m); };
  if (!/^[a-z0-9-]{1,40}$/.test(o.task || '')) err('--task must be a short lowercase key (a-z, 0-9, -)');
  if (!TIERS.includes(o.start)) err('--start must be one of ' + TIERS.join(', '));
  const final = o.final || o.start;
  if (!TIERS.includes(final)) err('--final must be one of ' + TIERS.join(', '));
  if (!['pass', 'fail'].includes(o.result)) err('--result must be pass or fail');
  const tokens = o.tokens === undefined ? null : Number(o.tokens);
  if (tokens !== null && !(Number.isInteger(tokens) && tokens >= 0)) err('--tokens must be a non-negative integer');
  const rework = yn(o.rework); const correction = yn(o.correction);
  if (rework === null || correction === null) err('--rework and --correction must be yes or no');
  if (o.size !== undefined && !['S', 'M', 'L', 'XL'].includes(o.size)) err('--size must be S, M, L or XL');
  if (o.worker !== undefined && !['sub', 'chat'].includes(o.worker)) err('--worker must be sub or chat');
  const boot = o.boot === undefined ? null : Number(o.boot);
  if (boot !== null && !(boot >= 0)) err('--boot must be a token count');
  const pct = o.pct === undefined ? null : Number(o.pct);
  if (pct !== null && !(pct >= 0 && pct <= 100)) err('--pct must be 0-100');
  return {
    ts: new Date().toISOString(), task: o.task, start: o.start, final, result: o.result,
    escalated: final !== o.start, tokens, rework, correction, size: o.size || null, pct, worker: o.worker || null, boot,
    note: String(o.note || '').replace(/[\r\n]+/g, ' ').slice(0, 200),
  };
}

// The first RESULT block's fields (status, commit, gates, test-guard ...), as { field: value }.
function parseResult(text) {
  const f = {};
  for (const l of String(text).replace(/\r\n/g, '\n').split('\n')) {
    const m = /^\s*[-*]?\s*`?([a-z][a-z -]{1,20}?)`?:\s+(.*)$/i.exec(l);
    if (!m) continue;
    const k = m[1].trim().toLowerCase();
    if (k === 'status' && f.status) break; // the next block starts
    if (!(k in f)) f[k] = m[2].replace(/\s{2,}\(.*$/, '').trim();
  }
  if (!f.status) throw new Error('no "status:" line: not a RESULT block (core/RESULT.md)');
  return f;
}

function fromResult(text, o) {
  const r = parseResult(text);
  const status = r.status.split(/[\s|]/)[0];
  const rework = /^needs-/.test(status) || /violation/i.test(r['test-guard'] || '') ? 'yes' : 'no';
  const note = [`${status}`, r.commit && r.commit !== 'none' ? `commit ${r.commit}` : null, r.gates ? `gates ${r.gates}` : null].filter(Boolean).join('; ');
  return { result: status === 'done' ? 'pass' : 'fail', rework, note, ...o };
}

function append(file, o) {
  const row = build(o);
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  fs.appendFileSync(file, JSON.stringify(row) + '\n');
  return row;
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  const start = cmd === 'from-result' ? 2 : 1;
  const o = {};
  for (let i = start; i < argv.length; i += 2) o[argv[i].replace(/^--/, '')] = argv[i + 1];
  if (!['append', 'from-result'].includes(cmd) || !o.log || (cmd === 'from-result' && !argv[1])) {
    console.error('usage: route-log.cjs append --log FILE --task T --start T1 --result pass|fail [...] | from-result <RESULT file> --log FILE --task T --start T1 [...]');
    process.exit(2);
  }
  try {
    const row = cmd === 'append' ? o : fromResult(fs.readFileSync(argv[1], 'utf8'), o);
    const r = append(o.log, row);
    console.log(`logged ${r.task} ${r.start}${r.escalated ? '->' + r.final : ''} ${r.result}${r.rework ? ' rework' : ''}`);
  } catch (e) { console.error('route-log: ' + e.message); process.exit(2); }
}

module.exports = { build, append, parseResult, fromResult, TIERS };
