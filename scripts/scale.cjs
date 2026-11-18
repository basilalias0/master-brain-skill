#!/usr/bin/env node
'use strict';
// scale.cjs: size a request and plan a parallel run (core/SCALE.md; owner, 2026-11-18). Zero model tokens.
//   size --files N --areas N --parts N --hours H [--new] [--risk]   prints the class S|M|L|XL and the path to take
//   plan <plan.json> [--cap N] [--left5h PCT] [--leftWeek PCT] [--pct5h X] [--pctWeek X] [--log routing-log.jsonl]
//     plan.json: { "tasks": [ { "id", "size": "S|M|L|XL", "deps": [ids], "hours"?, "tokens"?, "human_days"? } ] }
//     --cap      most workers that may run at once (chat capacity law: 4 per Master, times the Masters you will use)
//     --pct5h    % of the 5-hour window one million tokens costs; --pctWeek the same for the weekly window.
//                Measure them (get_usage before and after a task, logged with route-log --pct); without them the
//                windows are not estimated and the table says so.
//     --log      calibrates tokens per size (3 or more samples per size) and --pct5h (3 or more lines with --pct)
// Prints one row per worker count: wall hours, tokens, windows, what bounds it; then a recommendation.
// Exit: 0 ok, 2 bad input (unknown dep, cycle, bad size).
const fs = require('fs');

// Defaults, uncalibrated: agent hours and tokens per task by size. Tokens include reading, edits, tests and retries.
const SIZE = { S: { hours: 0.5, tokens: 60e3 }, M: { hours: 2, tokens: 200e3 }, L: { hours: 5, tokens: 500e3 }, XL: { hours: 10, tokens: 1.2e6 } };
const BOOT = 120e3; // one worker chat's start (measured 55-160k, core/IMPROVE.md §5)
const COORD = 15e3; // the Master's share per task: brief, RESULT, merge, sweep bookkeeping
const USABLE = 85; // % of a window spent before launches stop (TOKENS §6: 90% stops; keep a margin)

function classify({ files = 0, areas = 1, parts = 1, hours = 0, isNew = false, risk = false }) {
  let c = 'S';
  if (files > 3 || hours > 0.25 || parts > 1) c = 'M';
  if (parts >= 2 && (hours >= 2 || areas >= 2)) c = 'L';
  if (hours >= 8 || parts >= 5 || (isNew && areas >= 3)) c = 'XL';
  const path = {
    S: 'Master does it itself (lean)',
    M: 'one subagent or one worker; no question to the human',
    L: 'parallel workers, started without being asked: one line to the human, then dispatch',
    XL: 'scale mode (core/SCALE.md): research, interview, plan with worker options, the human picks N',
  }[c];
  return { class: c, path, high: risk };
}

function calibrate(logFile) {
  const out = JSON.parse(JSON.stringify(SIZE));
  if (!logFile || !fs.existsSync(logFile)) return { size: out, from: 'defaults' };
  const by = {}; const per = [];
  for (const l of fs.readFileSync(logFile, 'utf8').split('\n')) {
    let e; try { e = JSON.parse(l); } catch { continue; }
    if (e && SIZE[e.size] && typeof e.tokens === 'number') (by[e.size] = by[e.size] || []).push(e.tokens);
    if (e && typeof e.pct === 'number' && e.tokens > 0) per.push(e.pct / (e.tokens / 1e6));
  }
  const used = [];
  for (const [s, xs] of Object.entries(by)) {
    if (xs.length < 3) continue;
    xs.sort((a, b) => a - b);
    out[s].tokens = xs[Math.floor(xs.length / 2)];
    used.push(`${s} n=${xs.length}`);
  }
  per.sort((a, b) => a - b);
  const pct5h = per.length >= 3 ? per[Math.floor(per.length / 2)] : null;
  return { size: out, pct5h, from: used.length ? 'routing log median (' + used.join(', ') + ')' : 'defaults (fewer than 3 logged tasks per size)' };
}

function load(plan, size) {
  const tasks = (plan && plan.tasks) || [];
  if (!tasks.length) throw new Error('plan has no tasks');
  const byId = new Map();
  for (const t of tasks) {
    if (!t.id || byId.has(t.id)) throw new Error(`task id missing or repeated: ${t.id}`);
    if (!SIZE[t.size]) throw new Error(`task ${t.id}: size must be S, M, L or XL`);
    byId.set(t.id, { id: t.id, deps: t.deps || [], hours: t.hours ?? size[t.size].hours, tokens: t.tokens ?? size[t.size].tokens, human: t.human_days || 0 });
  }
  for (const t of byId.values()) for (const d of t.deps) if (!byId.has(d)) throw new Error(`task ${t.id}: unknown dep ${d}`);
  // Longest path to the end from each task (its priority) and a cycle check.
  const tail = new Map(); const seen = new Set();
  const users = new Map([...byId.keys()].map((k) => [k, []]));
  for (const t of byId.values()) for (const d of t.deps) users.get(d).push(t.id);
  const walk = (id) => {
    if (tail.has(id)) return tail.get(id);
    if (seen.has(id)) throw new Error(`dependency cycle at ${id}`);
    seen.add(id);
    const v = byId.get(id).hours + Math.max(0, ...users.get(id).map(walk));
    tail.set(id, v);
    return v;
  };
  for (const id of byId.keys()) walk(id);
  return { byId, tail };
}

// List scheduling, longest remaining path first: a standard heuristic, near optimal for a few workers.
function makespan({ byId, tail }, n) {
  const done = new Map(); const free = Array(n).fill(0); const left = new Set(byId.keys());
  while (left.size) {
    const ready = [...left].filter((id) => byId.get(id).deps.every((d) => done.has(d)));
    ready.sort((a, b) => tail.get(b) - tail.get(a));
    const id = ready[0];
    const w = free.indexOf(Math.min(...free));
    const start = Math.max(free[w], ...byId.get(id).deps.map((d) => done.get(d)));
    done.set(id, start + byId.get(id).hours);
    free[w] = done.get(id);
    left.delete(id);
  }
  return Math.max(...done.values());
}

function widest({ byId }) {
  const lvl = new Map();
  const at = (id) => { if (!lvl.has(id)) lvl.set(id, 1 + Math.max(0, ...byId.get(id).deps.map(at))); return lvl.get(id); };
  const count = {};
  for (const id of byId.keys()) count[at(id)] = (count[at(id)] || 0) + 1;
  return { width: Math.max(...Object.values(count)), waves: Object.keys(count).length };
}

function plan(p, o = {}) {
  const cal = calibrate(o.log);
  const g = load(p, cal.size);
  if (!o.pct5h && cal.pct5h) o = { ...o, pct5h: cal.pct5h };
  const tasks = [...g.byId.values()];
  const work = tasks.reduce((a, t) => a + t.hours, 0);
  const crit = Math.max(...g.tail.values());
  const { width, waves } = widest(g);
  const human = tasks.reduce((a, t) => a + t.human, 0);
  const cap = Math.max(1, Math.min(o.cap || 4, width));
  const rows = [];
  for (let n = 1; n <= cap; n++) {
    const tokens = tasks.reduce((a, t) => a + t.tokens + COORD, 0) + n * BOOT;
    let wall = makespan(g, n);
    let bound = wall <= crit + 1e-9 ? 'dependencies' : 'workers';
    const r = { n, tokens, wall };
    if (o.pct5h) {
      const need = (tokens / 1e6) * o.pct5h;
      const left = o.left5h ?? USABLE;
      r.windows5h = need <= left ? 0 : Math.ceil((need - left) / USABLE);
      // The last reset is windows × 5h away, and that window's share of the work still runs after it.
      const tokenWall = r.windows5h ? r.windows5h * 5 + wall / (r.windows5h + 1) : 0;
      if (tokenWall > wall) { wall = tokenWall; bound = '5-hour window'; }
    }
    if (o.pctWeek) {
      r.weekPct = Math.round((tokens / 1e6) * o.pctWeek);
      if (r.weekPct > (o.leftWeek ?? 100)) bound = 'weekly window: will not fit before the weekly reset';
    }
    r.wall = Math.round(wall * 10) / 10;
    r.bound = bound;
    rows.push(r);
  }
  const best = Math.min(...rows.map((r) => r.wall));
  const pick = rows.find((r) => r.wall <= best * 1.1 + 0.25);
  return { o, cal: cal.from, tasks: tasks.length, work, crit, width, waves, human, rows, pick };
}

function render(r, o) {
  const k = (x) => (x >= 1e6 ? (x / 1e6).toFixed(1) + 'M' : Math.round(x / 1e3) + 'k');
  const out = [`tasks ${r.tasks}, waves ${r.waves}, widest wave ${r.width}; work ${r.work}h, critical path ${r.crit}h; costs from ${r.cal}`];
  out.push('| workers | wall hours | tokens | extra 5h windows | weekly % | bound by |', '|---|---|---|---|---|---|');
  for (const x of r.rows) out.push(`| ${x.n} | ${x.wall} | ${k(x.tokens)} | ${x.windows5h ?? 'not measured'} | ${x.weekPct ?? 'not measured'} | ${x.bound} |`);
  const h = r.human ? `; ${r.human} human-days becomes about ${(r.pick.wall / 8).toFixed(1)} working days of wall time` : '';
  out.push(`recommend ${r.pick.n} worker(s): ${r.pick.wall}h wall, ${k(r.pick.tokens)} tokens${h}. More workers add boot tokens and do not beat the critical path.`);
  if (!r.o.pct5h) out.push('windows not estimated: pass --pct5h (measure it with get_usage before and after one task)');
  return out.join('\n');
}

function args(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--new') o.isNew = true;
    else if (a === '--risk') o.risk = true;
    else if (a.startsWith('--')) { const v = argv[++i]; o[a.slice(2)] = /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v; }
    else o._.push(a);
  }
  return o;
}

if (require.main === module) {
  const [cmd, ...rest] = process.argv.slice(2);
  const o = args(rest);
  try {
    if (cmd === 'size') { const r = classify(o); console.log(`${r.class}: ${r.path}${r.high ? ' (High risk: tier floors apply)' : ''}`); }
    else if (cmd === 'plan') { const r = plan(JSON.parse(fs.readFileSync(o._[0], 'utf8')), o); console.log(render(r, o)); }
    else { console.error('usage: scale.cjs size --files N --areas N --parts N --hours H [--new] [--risk] | plan <plan.json> [--cap N] [--pct5h X] [--left5h PCT] [--pctWeek X] [--leftWeek PCT] [--log FILE]'); process.exit(2); }
  } catch (e) { console.error(String(e.message || e)); process.exit(2); }
}

module.exports = { classify, plan, makespan, load, calibrate };
