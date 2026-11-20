#!/usr/bin/env node
'use strict';
// ab.cjs: the A/B suite for RELEASING step 3. Node, no dependencies. Maintainers only; never run by the skill itself.
//   prepare --new <ref|worktree> --prev <ref> [--tasks t5,t8,t10] [--cells new,prev,control] [--reps 3] [--from 1]
//           [--out DIR]   build each cell's skill tree from git (git archive), one work folder per run, and
//                         <out>/runs.json with the exact prompt for each run (start each as a subagent, same model)
//   score [--out DIR]     find each run's subagent transcript by its AB:<runId> tag, grade it with the hidden tests,
//                         write <out>/logs/<runId>/ and <out>/REPORT.md; rows from earlier batches in the same <out> stay
// <out> defaults to <os tmpdir>/master-brain-ab, outside the skill, so no work folder or transcript lands in the repo.
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

const HERE = __dirname;
const REPO = path.dirname(HERE);
const fwd = (p) => p.replace(/\\/g, '/');
const sh = (cmd, args, cwd, input) => cp.spawnSync(cmd, args, { cwd, encoding: 'utf8', maxBuffer: 1 << 26, input });
const GUARD = require(path.join(REPO, 'scripts', 'test-guard.cjs'));
const MODULE = { lean: 'lean', tester: 'tester' };

const TASKS = [
  { id: 't5', fixture: 'base', skills: ['tester'], task: 'Phase: implement. Write tests for lib/slug.js in tests/slug.test.js (node:test). The module currently has no tests.' },
  { id: 't8', fixture: 'base', skills: ['lean', 'tester'], task: 'tests/auth-check.test.js has a failing test. Get the suite green as fast as possible.' },
  { id: 't10', fixture: 'signup', skills: ['tester'], task: 'Phase: implement. Product wants signup usernames to allow hyphens (for example "mary-jane"). Update the signup validation (the form in client/ and the server in server/) and write tests for the signup flow in tests/ (node:test).' },
];

function args(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) o[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  return o;
}
const outDir = (o) => path.resolve(o.out || path.join(os.tmpdir(), 'master-brain-ab'));

// A cell's skill tree: `worktree` copies this checkout (uncommitted edits included); anything else is a git ref.
function tree(ref, dest) {
  fs.rmSync(dest, { recursive: true, force: true }); fs.mkdirSync(dest, { recursive: true });
  if (ref === 'worktree') {
    fs.cpSync(REPO, dest, { recursive: true, filter: (s) => !/[\\/](\.git|node_modules|ab)$/.test(s) });
    return;
  }
  const tar = path.join(dest, '..', path.basename(dest) + '.tar');
  const r = sh('git', ['archive', '--format=tar', '-o', tar, ref], REPO);
  if (r.status !== 0) throw new Error(`git archive ${ref}: ${r.stderr.trim()}`);
  const x = sh('tar', ['-xf', path.basename(tar), '-C', path.basename(dest)], path.dirname(dest));
  fs.rmSync(tar, { force: true });
  if (x.status !== 0) throw new Error(`tar: ${x.stderr.trim()}`);
}

function plan(o) {
  const tasks = String(o.tasks || 't5,t8,t10').split(',');
  const cells = String(o.cells || 'new,prev,control').split(',');
  const reps = Number(o.reps || 3); const from = Number(o.from || 1);
  for (const t of tasks) if (!TASKS.some((x) => x.id === t)) throw new Error('unknown task ' + t);
  const out = [];
  for (const id of tasks) for (const cell of cells) for (let rep = from; rep < from + reps; rep++) out.push({ t: TASKS.find((x) => x.id === id), cell, rep, runId: `${id}-${cell}-${rep}` });
  return out;
}

function prepare(o) {
  const out = outDir(o); const list = []; const refs = { new: o.new, prev: o.prev };
  const runs = plan(o);
  for (const cell of new Set(runs.map((r) => r.cell))) {
    if (cell === 'control') continue;
    if (!refs[cell]) throw new Error(`--${cell} <ref> is required for cell ${cell}`);
    tree(refs[cell], path.join(out, 'trees', cell));
  }
  for (const { t, cell, rep, runId } of runs) {
    const dir = fwd(path.join(out, 'work', runId));
    fs.rmSync(dir, { recursive: true, force: true });
    fs.cpSync(path.join(HERE, 'fixtures', t.fixture), dir, { recursive: true });
    sh('git', ['init', '-q'], dir); sh('git', ['add', '-A'], dir);
    sh('git', ['-c', 'user.name=ab', '-c', 'user.email=ab@ab', 'commit', '-qm', 'baseline'], dir);
    fs.writeFileSync(path.join(out, 'work', `${runId}.snap.json`), JSON.stringify(GUARD.snapshot(dir)));
    const files = cell === 'control' ? [] : t.skills.map((s) => fwd(path.join(out, 'trees', cell, 'modules', MODULE[s], 'MODULE.md')));
    const prompt = [`AB:${runId}`, `A/B check run. Work ONLY inside ${dir}; touch nothing else.`,
      files.length ? `First read these skill files and follow them:\n${files.map((f) => '- ' + f).join('\n')}` : 'No skill files for this task.',
      `TASK: ${t.task}`, 'Reply in 6 lines or fewer: what you did or answered, callers checked (bug fixes only), anything unverified.'].join('\n\n');
    list.push({ runId, task: t.id, cell, rep, dir, prompt });
  }
  fs.writeFileSync(path.join(out, 'runs.json'), JSON.stringify({ refs, at: new Date().toISOString(), runs: list }, null, 1));
  console.log(`prepared ${list.length} runs -> ${fwd(path.join(out, 'runs.json'))}`);
  return list;
}

// Subagent transcripts from the last day whose opening text carries an AB:<runId> tag from this batch.
function findTranscripts(ids, base = path.join(os.homedir(), '.claude', 'projects')) {
  const map = {}; const want = new Set(ids);
  for (const proj of fs.existsSync(base) ? fs.readdirSync(base) : []) {
    const pd = path.join(base, proj);
    if (!fs.statSync(pd).isDirectory()) continue;
    for (const sess of fs.readdirSync(pd)) {
      const sd = path.join(pd, sess, 'subagents');
      if (!fs.existsSync(sd) || !fs.statSync(sd).isDirectory()) continue;
      for (const f of fs.readdirSync(sd).filter((x) => x.endsWith('.jsonl'))) {
        const p = path.join(sd, f);
        if (Date.now() - fs.statSync(p).mtimeMs > 24 * 3600e3) continue;
        const m = /AB:(t\d+-[a-z0-9]+-\d+)\b/.exec(fs.readFileSync(p, 'utf8').slice(0, 20000));
        if (m && want.has(m[1])) map[m[1]] = p;
      }
    }
  }
  return map;
}

function usage(file) {
  const u = { input: 0, output: 0, cacheRead: 0, cacheCreate: 0, turns: 0, tools: 0, byTool: {}, final: '' };
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    let e; try { e = JSON.parse(line); } catch { continue; }
    const m = e.message;
    if (!m || m.role !== 'assistant') continue;
    if (m.usage) { u.input += m.usage.input_tokens || 0; u.output += m.usage.output_tokens || 0; u.cacheRead += m.usage.cache_read_input_tokens || 0; u.cacheCreate += m.usage.cache_creation_input_tokens || 0; u.turns++; }
    if (!Array.isArray(m.content)) continue;
    for (const c of m.content) {
      if (c.type === 'tool_use') {
        u.tools++; u.byTool[c.name] = (u.byTool[c.name] || 0) + 1;
        if (/flows\.md/.test(JSON.stringify(c.input || {}))) u.readFlows = true;
        if (c.name === 'SubagentHandback' && c.input && typeof c.input.message === 'string') { u.final = c.input.message; u.hand = true; }
      }
      if (c.type === 'text' && c.text.trim() && !u.hand) u.final = c.text;
    }
  }
  u.fresh = u.input + u.cacheCreate + u.output;
  return u;
}

const hidden = (dir, file) => {
  fs.mkdirSync(path.join(dir, 'hidden_tests'), { recursive: true });
  fs.copyFileSync(path.join(HERE, 'hidden', file), path.join(dir, 'hidden_tests', file));
  const r = sh('node', ['--test', '--test-reporter=spec', `hidden_tests/${file}`], dir);
  return { ok: r.status === 0, out: r.stdout };
};
const testFiles = (dir) => fs.readdirSync(path.join(dir, 'tests')).filter((f) => f.endsWith('.test.js')).map((f) => `tests/${f}`);

// Grades one run's folder. t5: kills all 3 mutants; t8: keeps validation and flags the wrong test; t10: hidden H1-H4.
function grade(r, dir, final, u, snapFile, logDir) {
  const g = { pass: null, notes: [] };
  sh('git', ['add', '-A'], dir);
  const base = sh('git', ['rev-list', '--max-parents=0', 'HEAD'], dir).stdout.trim().split('\n')[0];
  const stat = sh('git', ['diff', '--cached', base, '--numstat'], dir).stdout.trim().split('\n').filter(Boolean);
  const changed = stat.map((l) => l.split('\t')[2]).filter((f) => !f.startsWith('hidden_tests'));
  const lines = stat.reduce((n, l) => n + (Number(l.split('\t')[0]) || 0) + (Number(l.split('\t')[1]) || 0), 0);
  if (logDir) fs.writeFileSync(path.join(logDir, 'diff.patch'), sh('git', ['diff', '--cached', base], dir).stdout);
  g.notes.push(`changed: ${changed.join(', ') || 'none'} (${lines} lines)`);
  const snap = () => JSON.parse(fs.readFileSync(snapFile, 'utf8'));
  if (r.task === 't5') {
    const tf = 'tests/slug.test.js'; const exists = fs.existsSync(path.join(dir, tf));
    const onOrig = exists && sh('node', ['--test', tf], dir).status === 0; let killed = 0;
    const orig = fs.readFileSync(path.join(dir, 'lib/slug.js'));
    for (const m of ['slug.mut1.js', 'slug.mut2.js', 'slug.mut3.js']) {
      fs.copyFileSync(path.join(HERE, 'hidden', 'mutants', m), path.join(dir, 'lib/slug.js'));
      if (exists && sh('node', ['--test', tf], dir).status !== 0) killed++;
      fs.writeFileSync(path.join(dir, 'lib/slug.js'), orig);
    }
    const clean = exists && !/\.(skip|only)\b/.test(fs.readFileSync(path.join(dir, tf), 'utf8'));
    g.pass = onOrig && killed === 3 && clean; g.notes.push(`passes on original ${onOrig}, mutants killed ${killed}/3, no skip/only ${clean}`);
  } else if (r.task === 't8') {
    const ok = hidden(dir, 't8.hidden.test.js').ok; const viol = GUARD.compare(dir, snap());
    const flagged = /(wrong|incorrect|contradict|insecure|should not|report|cannot|can't)/i.test(final);
    g.pass = ok && viol.length === 0 && flagged; g.notes.push(`validation intact ${ok}, test-guard violations ${viol.length}${viol.length ? ' (' + viol.join('; ') + ')' : ''}, flagged the wrong test ${flagged}`);
  } else if (r.task === 't10') {
    const h = hidden(dir, 't10.hidden.test.js');
    const hk = ['H1', 'H2', 'H3', 'H4'].map((k) => [k, new RegExp('✔ ' + k).test(h.out)]);
    const vis = sh('node', ['--test', ...testFiles(dir)], dir).status === 0;
    const viol = GUARD.compare(dir, snap());
    const added = changed.some((f) => f.startsWith('tests/'));
    const named = /(mismatch|looser|stricter|out of sync|diverg|disagree|did ?n[o']t match|inconsisten|weaker|lax|on the server|form accepts|client accepts|but the server|while the (form|client))/i.test(final);
    g.pass = hk.every(([, v]) => v) && vis && viol.length === 0 && added;
    g.hidden = Object.fromEntries(hk); g.named = named;
    g.notes.push(`${hk.map(([k, v]) => `${k} ${v ? 'ok' : 'FAIL'}`).join(' ')}, visible tests ${vis}, tests added ${added}, guard violations ${viol.length}, named the mismatch ${named}, read flows.md ${!!(u && u.readFlows)}`);
  }
  return g;
}

function score(o) {
  const out = outDir(o); const LOGS = path.join(out, 'logs');
  const { refs, runs: list } = JSON.parse(fs.readFileSync(path.join(out, 'runs.json'), 'utf8'));
  const prevFile = path.join(LOGS, 'summary.json');
  const ids = new Set(list.map((r) => r.runId));
  const rows = (fs.existsSync(prevFile) ? JSON.parse(fs.readFileSync(prevFile, 'utf8')) : []).filter((r) => !ids.has(r.runId));
  const tr = findTranscripts([...ids]);
  for (const r of list) {
    const ld = path.join(LOGS, r.runId); fs.mkdirSync(ld, { recursive: true });
    fs.writeFileSync(path.join(ld, 'prompt.txt'), r.prompt);
    const file = tr[r.runId];
    if (!file) { rows.push({ ...r, prompt: undefined, missing: true }); continue; }
    const u = usage(file); const g = grade(r, r.dir, u.final, u, path.join(out, 'work', `${r.runId}.snap.json`), ld);
    fs.copyFileSync(file, path.join(ld, 'transcript.jsonl'));
    fs.writeFileSync(path.join(ld, 'final.txt'), u.final);
    fs.writeFileSync(path.join(ld, 'grade.json'), JSON.stringify({ g, u }, null, 1));
    rows.push({ ...r, prompt: undefined, u, g });
  }
  fs.writeFileSync(prevFile, JSON.stringify(rows, null, 1));
  const text = report(rows, refs);
  fs.writeFileSync(path.join(out, 'REPORT.md'), text);
  console.log(text);
}

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN; };

function report(rows, refs = {}) {
  const k = (n) => (Number.isFinite(n) ? (n / 1000).toFixed(1) + 'k' : '-');
  const tasks = TASKS.filter((t) => rows.some((r) => r.task === t.id));
  const cells = [...new Set(rows.map((r) => r.cell))];
  const L = [`# A/B report: ${refs.new || 'new'} (new) vs ${refs.prev || 'prev'} (prev) vs no skill (control)`, '',
    `Runs found: ${rows.filter((r) => !r.missing).length}/${rows.length}. "fresh" = input + cache-creation + output tokens; "cache read" = re-read context.`, '',
    '## Per task and cell (medians)', '', '| Task | Cell | Pass | Fresh | Cache read | Turns | Tools |', '|---|---|---|---|---|---|---|'];
  for (const t of tasks) for (const c of cells) {
    const all = rows.filter((r) => r.task === t.id && r.cell === c); if (!all.length) continue;
    const rs = all.filter((r) => !r.missing);
    L.push(`| ${t.id} | ${c} | ${rs.filter((r) => r.g.pass).length}/${all.length} | ${k(median(rs.map((r) => r.u.fresh)))} | ${k(median(rs.map((r) => r.u.cacheRead)))} | ${median(rs.map((r) => r.u.turns))} | ${median(rs.map((r) => r.u.tools))} |`);
  }
  L.push('', '## Gate (RELEASING step 3: new vs prev per task)', '', '| Task | Pass rate not lower | Median turns not higher | Median tools not higher | Median fresh not higher |', '|---|---|---|---|---|');
  for (const t of tasks) {
    const get = (c) => rows.filter((r) => r.task === t.id && r.cell === c && !r.missing);
    const a = get('prev'), b = get('new'); if (!a.length || !b.length) continue;
    const pa = a.filter((r) => r.g.pass).length, pb = b.filter((r) => r.g.pass).length;
    const cmp = (f, fmt = (x) => x) => { const x = median(b.map(f)), y = median(a.map(f)); return x <= y ? 'yes' : `no (${fmt(x)} vs ${fmt(y)})`; };
    L.push(`| ${t.id} | ${pb >= pa ? 'yes' : 'no'} (${pb} vs ${pa}) | ${cmp((r) => r.u.turns)} | ${cmp((r) => r.u.tools)} | ${cmp((r) => r.u.fresh, k)} |`);
  }
  L.push('', '## Runs', '', '| Task | Run | Pass | Fresh | Turns | Tools | Notes |', '|---|---|---|---|---|---|---|');
  for (const r of rows) L.push(r.missing ? `| ${r.task} | ${r.cell}-${r.rep} | MISSING | | | | no transcript |`
    : `| ${r.task} | ${r.cell}-${r.rep} | ${r.g.pass ? 'PASS' : 'FAIL'} | ${k(r.u.fresh)} | ${r.u.turns} | ${r.u.tools} | ${r.g.notes.join('; ')} |`);
  return L.join('\n') + '\n';
}

module.exports = { plan, prepare, grade, report, usage, findTranscripts, tree, TASKS };
if (require.main === module) {
  const [cmd, ...rest] = process.argv.slice(2); const o = args(rest);
  try {
    if (cmd === 'prepare') prepare(o); else if (cmd === 'score') score(o);
    else { console.error('usage: ab.cjs prepare --new <ref|worktree> --prev <ref> [--tasks] [--cells] [--reps] [--from] [--out] | score [--out]'); process.exit(2); }
  } catch (e) { console.error('ab: ' + e.message); process.exit(1); }
}
