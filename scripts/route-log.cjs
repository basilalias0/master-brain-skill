#!/usr/bin/env node
'use strict';
// route-log.cjs append --log FILE --task TYPE --start T1 --result pass|fail [--final T2] [--tokens N]
//                      [--rework yes|no] [--correction yes|no] [--note TEXT]
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
  return {
    ts: new Date().toISOString(), task: o.task, start: o.start, final, result: o.result,
    escalated: final !== o.start, tokens, rework, correction,
    note: String(o.note || '').replace(/[\r\n]+/g, ' ').slice(0, 200),
  };
}

function append(file, o) {
  const row = build(o);
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  fs.appendFileSync(file, JSON.stringify(row) + '\n');
  return row;
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const o = {};
  for (let i = 1; i < argv.length; i += 2) o[argv[i].replace(/^--/, '')] = argv[i + 1];
  if (argv[0] !== 'append' || !o.log) { console.error('usage: route-log.cjs append --log FILE --task T --start T1 --result pass|fail [...]'); process.exit(2); }
  try { const r = append(o.log, o); console.log(`logged ${r.task} ${r.start}${r.escalated ? '->' + r.final : ''} ${r.result}`); }
  catch (e) { console.error('route-log: ' + e.message); process.exit(2); }
}

module.exports = { build, append, TIERS };
