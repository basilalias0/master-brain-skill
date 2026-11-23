#!/usr/bin/env node
'use strict';
// worker.cjs choose: subagent or worker chat for one task (owner, 2026-11-23). Zero model tokens.
//   choose --size S|M|L [--master-ctx N] [--at N] [--steer] [--outlive] [--running K] [--cap N] [--warm H]
//          [--boot-sub N] [--boot-chat N] [--log routing-log.jsonl]
// Hard rules first, then the cheaper of the two costs. Costs are in effective tokens: a cached re-read counts 0.1.
//   subagent = boot_sub + work + 0.1 x master_ctx              (1 Master step: the completion notice)
//            + 0.1 x summary x later_master_steps               (its report stays in the Master's chat)
//   chat     = boot_chat + work + 0.1 x master_ctx x rounds      (brief, RESULT, RESET: each wakes the Master)
//            + 0.1 x warm x steps                               (a reused chat re-reads its old history each step)
// Hard rules: --steer (the human types into it mid-task) or --outlive (it must keep running when the Master ends) -> chat.
// The Master within 20k of its rollover point -> roll over first: a clear or a new chat ends its running subagents.
// --running at --cap (subagents now running vs the capacity cap) -> chat. XL -> never one worker: scale mode splits it.
// Defaults are uncalibrated until 3 logged tasks per kind (route-log lines with "worker":"sub"|"chat" and tokens).
// Exit: 0 a choice printed, 2 bad input.
const fs = require('fs');

const WORK = { S: 30e3, M: 120e3, L: 350e3 }; // tokens of real work per size, either way
const STEPS = { S: 8, M: 20, L: 45 }; // steps that work takes
const BOOT = { sub: 40e3, chat: 100e3 }; // start cost: a subagent skips the chat boot (a worker chat: 55-160k measured)
const SUMMARY = 2e3; // a subagent's report, briefed to 10 lines
const LATER = 30; // Master steps that re-read that report before the Master rolls over
const ROUNDS = 3; // Master wake-ups a worker chat costs: brief sent, RESULT read, RESET sent
const MARGIN = 20e3;

function calibrate(file) {
  const out = { ...BOOT }; const xs = { sub: [], chat: [] };
  if (file && fs.existsSync(file)) {
    for (const l of fs.readFileSync(file, 'utf8').split('\n')) {
      let e; try { e = JSON.parse(l); } catch { continue; }
      if (e && xs[e.worker] && typeof e.boot === 'number') xs[e.worker].push(e.boot);
    }
  }
  const used = [];
  for (const k of ['sub', 'chat']) {
    if (xs[k].length < 3) continue;
    xs[k].sort((a, b) => a - b); out[k] = xs[k][Math.floor(xs[k].length / 2)]; used.push(`${k} n=${xs[k].length}`);
  }
  return { boot: out, basis: used.length ? 'measured (' + used.join(', ') + ')' : 'uncalibrated defaults' };
}

function choose(o) {
  const size = String(o.size || '').toUpperCase();
  if (size === 'XL') return { pick: 'scale mode', why: 'XL is never one worker: split it (core/SCALE.md §2)' };
  if (!WORK[size]) throw new Error('--size must be S, M, L or XL');
  if (o.steer) return { pick: 'worker chat', why: 'the human needs to type into it mid-task' };
  if (o.outlive) return { pick: 'worker chat', why: 'it must keep running after the Master ends' };
  const ctx = Number(o['master-ctx'] || 0); const at = Number(o.at || 250e3);
  if (ctx && ctx >= at - MARGIN) return { pick: 'roll over first', why: `Master at ${Math.round(ctx / 1e3)}k, rollover at ${Math.round(at / 1e3)}k: a clear or new chat ends running subagents` };
  const cap = Number(o.cap ?? 2); const running = Number(o.running || 0);
  if (running >= cap) return { pick: 'worker chat', why: `${running} subagents already running (cap ${cap})` };
  const cal = calibrate(o.log);
  const boot = { sub: Number(o['boot-sub'] || cal.boot.sub), chat: Number(o['boot-chat'] || cal.boot.chat) };
  const warm = Number(o.warm || 0);
  const sub = boot.sub + WORK[size] + 0.1 * ctx + 0.1 * SUMMARY * LATER;
  const chat = boot.chat + WORK[size] + 0.1 * ctx * ROUNDS + 0.1 * warm * STEPS[size];
  const pick = sub <= chat ? 'subagent' : 'worker chat';
  return { pick, sub: Math.round(sub), chat: Math.round(chat), basis: cal.basis, why: `${pick === 'subagent' ? 'subagent' : 'chat'} is cheaper` };
}

function args(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--steer' || a === '--outlive') o[a.slice(2)] = true;
    else if (a.startsWith('--')) o[a.slice(2)] = argv[++i];
  }
  return o;
}

if (require.main === module) {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd !== 'choose') { console.error('usage: worker.cjs choose --size S|M|L [--master-ctx N] [--steer] [--outlive] [--running K] [--cap N] [--warm H] [--log FILE]'); process.exit(2); }
  try {
    const r = choose(args(rest));
    const k = (x) => Math.round(x / 1e3) + 'k';
    console.log(`${r.pick}: ${r.why}` + (r.sub ? ` (subagent ${k(r.sub)} vs chat ${k(r.chat)}; ${r.basis})` : ''));
  } catch (e) { console.error(String(e.message || e)); process.exit(2); }
}

module.exports = { choose, calibrate };
