#!/usr/bin/env node
'use strict';
// cycle.cjs <master_dir> --ctx <tokens> --week <pct> [--five <pct>] [--role chief|master] [--self M3] [--at N]
//           [--window N] [--tasks score:hold:state,...] [--mode auto|default|...]
// The once-per-cycle check for a Chief or Master, 8 lines or fewer, zero model tokens. Feed it get_usage numbers.
//   rollover: due or not (rollover.cjs; point = --at, else "roll over at <N>k" in LAWS.md law 12, else 250k); when due,
//             also the method law 12 picks (rollover.cjs choose: the fewer tokens, a tie to clear in place). --mode is
//             this chat's permission mode (get_session self at boot); omitted = auto, which counts one more step.
//   usage:    the TOKENS section 6 table (decisions.cjs usage-gate; --five omitted = weekly only)
//   capacity: load and room for the open tasks (capacity.cjs load; context % = ctx / --window, default 500k)
// Exit: 0 always, 2 bad input.
const fs = require('fs');
const path = require('path');
const { due, choose } = require('./rollover.cjs');
const { usageGate } = require('./decisions.cjs');
const { load } = require('./capacity.cjs');

const k = (n) => `${Math.round(n / 1000)}k`;

function point(dir) {
  try {
    const m = /roll(?:s)? over at `?(\d+)k/i.exec(fs.readFileSync(path.join(dir, 'LAWS.md'), 'utf8'));
    if (m) return Number(m[1]) * 1000;
  } catch {}
  return 250000;
}

function cycle(dir, o) {
  if (!dir || !fs.existsSync(dir)) throw new Error(`no master_dir "${dir}"`);
  const ctx = Number(o.ctx);
  if (!(ctx >= 0)) throw new Error('--ctx must be the context tokens from get_usage');
  if (o.week === undefined) throw new Error('--week must be the weekly % from get_usage');
  const role = o.role || 'master';
  if (!['chief', 'master'].includes(role)) throw new Error(`bad role "${role}" (chief|master)`);
  const at = o.at ? Number(o.at) : point(dir);
  const out = [];
  if (due(ctx, at)) {
    const chat = role === 'chief' ? 'C1' : (o.self || 'M#');
    out.push(`rollover: DUE (context ${k(ctx)} >= ${k(at)}): finish the step, write the LAST block and BOARD, ask the human`);
    out.push('rollover ' + choose(dir, { ctx, chat, mode: o.mode || 'auto' }).line);
  } else out.push(`rollover: not due (context ${k(ctx)} < ${k(at)})`);
  const five = o.five === undefined ? 0 : o.five;
  out.push(usageGate(five, o.week).line + (o.five === undefined ? ' (5-hour not given)' : ''));
  const window = Number(o.window || 500000);
  const pct = Math.min(100, Math.round((ctx / window) * 100));
  const tasks = o.tasks ? String(o.tasks).split(',').filter(Boolean) : [];
  const cap = load(role, pct, tasks, null).lines.filter((l) => !/^\s/.test(l));
  out.push(...cap.map((l) => 'capacity: ' + l));
  return out.slice(0, 8);
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const o = {};
  for (let i = 1; i < argv.length; i += 2) o[argv[i].replace(/^--/, '')] = argv[i + 1];
  try {
    if (!argv[0] || argv[0].startsWith('--')) throw new Error('usage: cycle.cjs <master_dir> --ctx <tokens> --week <pct> [--five <pct>] [--role chief|master] [--at N] [--window N] [--tasks a,b]');
    console.log(cycle(argv[0], o).join('\n'));
  } catch (e) { console.error(String(e.message || e)); process.exit(2); }
}

module.exports = { cycle, point };
