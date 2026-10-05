#!/usr/bin/env node
'use strict';
// route-stats.cjs report LOG [--min 8] [--default task=T1,task2=T0] [--write DIR]
// Reads the routing log and prints evidence plus PROPOSED changes. It never edits MODELS.md or any skill.
// A proposal needs at least --min samples. --default should come from the routing table in MODELS.md;
// without it the most-used start tier per task is assumed.
const fs = require('fs');
const path = require('path');

const TIERS = ['T0', 'T1', 'T2', 'T3'];
const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);

function load(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter((e) => e && TIERS.includes(e.start));
}

function analyse(entries, { min = 8, defaults = {} } = {}) {
  const byTask = {};
  for (const e of entries) {
    const t = (byTask[e.task] = byTask[e.task] || { n: 0, rework: 0, correction: 0, tiers: {} });
    t.n++; if (e.rework) t.rework++; if (e.correction) t.correction++;
    const s = (t.tiers[e.start] = t.tiers[e.start] || { n: 0, first: 0, tokens: 0, tokN: 0 });
    s.n++; if (e.result === 'pass' && !e.escalated) s.first++;
    if (typeof e.tokens === 'number') { s.tokens += e.tokens; s.tokN++; }
  }
  const proposals = []; const collecting = [];
  for (const [task, t] of Object.entries(byTask)) {
    const used = Object.keys(t.tiers).sort();
    const cur = defaults[task] || used.sort((a, b) => t.tiers[b].n - t.tiers[a].n)[0];
    if (t.n < min) { collecting.push(`${task}: ${t.n}/${min} samples`); continue; }
    const rate = (tier) => (t.tiers[tier] ? t.tiers[tier].first / t.tiers[tier].n : null);
    const ev = (tier) => `${tier}: ${t.tiers[tier].first}/${t.tiers[tier].n} first-try (${pct(t.tiers[tier].first, t.tiers[tier].n)}%)`;
    const lower = TIERS.filter((x) => TIERS.indexOf(x) < TIERS.indexOf(cur) && t.tiers[x] && t.tiers[x].n >= min && rate(x) >= 0.9)[0];
    if (lower) proposals.push({ task, type: 'routing', kind: 'lower', text: `Lower the default for "${task}" from ${cur} to ${lower}. Evidence: ${ev(lower)}.` });
    else if (t.tiers[cur] && t.tiers[cur].n >= min && rate(cur) < 0.7) {
      const next = TIERS[TIERS.indexOf(cur) + 1];
      proposals.push({ task, type: 'routing', kind: 'raise', text: `Raise the default for "${task}" from ${cur}${next ? ' to ' + next : ''} (or review the brief). Evidence: ${ev(cur)}.` });
    }
    const ruleType = t.n >= 2 * min ? 'generic' : 'local-rule';
    if (t.rework / t.n > 0.3) proposals.push({ task, type: ruleType, kind: 'brief', text: `"${task}" needed rework in ${pct(t.rework, t.n)}% of ${t.n} tasks: improve the brief template or the file targets it carries.` });
    if (t.correction / t.n > 0.2) proposals.push({ task, type: ruleType, kind: 'review', text: `The user corrected "${task}" in ${pct(t.correction, t.n)}% of ${t.n} tasks: review the rule or skill text it relies on.` });
  }
  return { byTask, proposals, collecting };
}

function render({ byTask, proposals, collecting }, min) {
  const L = ['# Routing report', '', '| Task | n | Start tier | n | First-try pass | Avg tokens | Rework | Corrected |', '|---|---|---|---|---|---|---|---|'];
  for (const [task, t] of Object.entries(byTask)) {
    for (const tier of Object.keys(t.tiers).sort()) {
      const s = t.tiers[tier];
      L.push(`| ${task} | ${t.n} | ${tier} | ${s.n} | ${pct(s.first, s.n)}% | ${s.tokN ? Math.round(s.tokens / s.tokN) : '-'} | ${pct(t.rework, t.n)}% | ${pct(t.correction, t.n)}% |`);
    }
  }
  L.push('', 'Types: routing = a MODELS.md row; local-rule = an overlay rule for this project; generic = also worth contributing.');
  L.push('', `## Proposals (need your approval; minimum ${min} samples each)`, '');
  L.push(...(proposals.length ? proposals.map((p, i) => `${i + 1}. [${p.type}/${p.kind}] ${p.text}`) : ['None. No change is justified by the data yet.']));
  if (collecting.length) L.push('', 'Still collecting: ' + collecting.join('; '));
  return L.join('\n') + '\n';
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
  if (argv[0] !== 'report' || !argv[1]) { console.error('usage: route-stats.cjs report LOG [--min 8] [--default task=T1,...] [--write DIR]'); process.exit(2); }
  const min = Number(flag('--min', 8));
  const defaults = Object.fromEntries((flag('--default', '') || '').split(',').filter(Boolean).map((x) => x.split('=')));
  const res = analyse(load(argv[1]), { min, defaults });
  const out = render(res, min);
  console.log(out);
  const dir = flag('--write', null);
  if (dir) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, '..', 'last-run.json'), JSON.stringify({ date: new Date().toISOString().slice(0, 10), entries: load(argv[1]).length }) + '\n');
  }
  if (dir && res.proposals.length) {
    const f = path.join(dir, new Date().toISOString().slice(0, 10) + '-routing.md');
    fs.writeFileSync(f, out + '\nStatus: pending (the user decides; one change at a time)\n');
    console.log('proposal file: ' + f);
  }
}

module.exports = { analyse, load, render };
