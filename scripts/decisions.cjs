#!/usr/bin/env node
'use strict';
// decisions.cjs: decision follow-up in ACTION_LOG and the arena guards. Zero model tokens. Rules: procedure/05.
//   lint <ACTION_LOG>                  DL ids unique; optional Confidence 0-100, Review-by YYYY-MM-DD; Supersedes exists
//   due <ACTION_LOG> [--today D]       DL entries past Review-by, or with "failure-signal seen" in an Outcome line
//   find <ACTION_LOG> <keywords...>    top 3 DL entries by keyword overlap (signature, Keywords, Trigger)
//   next-id <ACTION_LOG>               the next free DL id, counting the dated archives next to the log too
//   archive <ACTION_LOG> [--max N] [--today D] [--write]   past N lines (200, law 19) move the oldest entries not
//                                      under review to ACTION_LOG-YYYY-MM.md, verbatim; a dry run without --write
//   check-private <dir> --skill <root> the folder is outside the skill, not under a `skills` folder, not tracked by git
//   scan-task <arena dir>              task.md (+ baseline.md) hold no secrets or denied words (MB_DENY)
//   usage-gate --five <pct> --week <pct> [--wave]       the TOKENS section 6 table; a missing value counts as 90
//   tree-hash <dir> [--skip <dir>]...  one "<sha256> <path>" line per file, for before/after snapshots
//   preflight <master_dir> --five <pct> --week <pct> [--yes] [--project DIR] [--skills-dir DIR]
//                                      the arena pre-flight: items 1-2 before the offer; with --yes (after the
//                                      owner's yes) items 3-7 too. Stops at the first failed item and names it.
// A DL entry is a "## DL-NNN — <signature>" heading in ACTION_LOG (templates/ACTION_LOG.md), fields one per line.
// Older project logs use "## DL-NNN · YYYY-MM-DD · <title>"; both are read (DL_HEAD).
// Exit: 0 ok, 1 refused or lint errors, 2 unreadable input or usage.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cp = require('child_process');
const { secretRes, denyRes } = require('./verify.cjs');

// TOKENS section 6 usage table: window -> threshold -> actions. A test checks this equals the table in core/TOKENS.md.
const TABLE = { five: { 70: ['drop', 'no-arena'], 90: ['stop'] }, week: { 70: ['no-arena'], 80: ['drop'], 90: ['stop'] } };
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DL_HEAD = /^## (DL-\d+) (?:—|·) (.+)$/;

class InputError extends Error {}
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const needDir = (d) => { if (!d || !fs.existsSync(d) || !fs.statSync(d).isDirectory()) throw new InputError('not a readable folder: ' + d); return d; };

function entries(log) {
  if (!log || !fs.existsSync(log) || !fs.statSync(log).isFile()) throw new InputError('not a readable ACTION_LOG: ' + log);
  const out = []; let cur = null;
  for (const l of fs.readFileSync(log, 'utf8').replace(/\r\n/g, '\n').split('\n')) {
    const h = DL_HEAD.exec(l);
    if (h) { cur = { id: h[1], signature: h[2].trim(), fields: {}, outcome: [] }; out.push(cur); continue; }
    if (/^#{1,2} /.test(l)) { cur = null; continue; }
    if (!cur) continue;
    const o = /^Outcome (\d{4}-\d{2}-\d{2}): (.*)$/.exec(l);
    if (o) { cur.outcome.push({ date: o[1], text: o[2] }); continue; }
    const m = /^([A-Z][A-Za-z/ -]+): ?(.*)$/.exec(l);
    if (m && !(m[1] in cur.fields)) cur.fields[m[1]] = m[2].replace(/\s{2,}\(optional.*$/, '').trim();
  }
  return out;
}

function lint(log) {
  const all = entries(log);
  const ids = new Set();
  const errors = [];
  for (const e of all) {
    const say = (m) => errors.push(`${e.id}: ${m}`);
    if (ids.has(e.id)) say('id used twice'); ids.add(e.id);
    const c = e.fields.Confidence;
    if (c !== undefined && !(/^\d{1,3}$/.test(c) && Number(c) <= 100)) say('Confidence must be 0-100');
    const r = e.fields['Review-by'];
    if (r !== undefined && !DATE.test(r)) say('Review-by must be YYYY-MM-DD');
  }
  const archived = new Set(archives(log).flatMap((f) => entries(f).map((e) => e.id)));
  for (const e of all) { const s = e.fields.Supersedes; if (s && s !== 'none' && !ids.has(s) && !archived.has(s)) errors.push(`${e.id}: Supersedes names an entry that does not exist: ${s}`); }
  return { errors, count: all.length };
}

// The dated archives next to a log: ACTION_LOG.md -> ACTION_LOG-YYYY-MM.md (law 19).
function archives(log) {
  const dir = path.dirname(log), base = path.basename(log, '.md');
  return fs.readdirSync(dir).filter((f) => new RegExp('^' + base + '-\\d{4}-\\d{2}\\.md$').test(f)).map((f) => path.join(dir, f));
}

// Past `max` lines, move the oldest DL entries verbatim to <log>-YYYY-MM.md next to it. An entry still under review
// (Review-by ahead) or due stays live, so `due` keeps seeing it. Dry run unless `write`.
function archive(log, { max = 200, today = new Date().toISOString().slice(0, 10), write = false } = {}) {
  const all = entries(log);
  const lines = fs.readFileSync(log, 'utf8').replace(/\r\n/g, '\n').split('\n');
  const heads = lines.flatMap((l, i) => (/^#{1,2} /.test(l) ? [i] : []));
  const blocks = heads.filter((i) => DL_HEAD.test(lines[i])).map((i) => ({ id: /DL-\d+/.exec(lines[i])[0], start: i, end: heads.find((h) => h > i) ?? lines.length }));
  const dueIds = new Set(due(log, today).map((l) => l.split(' ')[0]));
  const keep = (id) => { const e = all.find((x) => x.id === id); const r = e && e.fields['Review-by']; return dueIds.has(id) || (DATE.test(r || '') && r > today); };
  const file = path.join(path.dirname(log), `${path.basename(log, '.md')}-${today.slice(0, 7)}.md`);
  const res = { before: lines.length, after: lines.length, moved: [], kept: [], found: blocks.length, file };
  if (lines.length <= max) return res;
  const out = new Set();
  for (const b of blocks) {
    if (res.after <= max) break;
    if (keep(b.id)) { res.kept.push(b.id); continue; }
    res.moved.push(b.id); res.after -= b.end - b.start;
    for (let i = b.start; i < b.end; i++) out.add(i);
  }
  if (write && res.moved.length) {
    const moved = lines.filter((_, i) => out.has(i)).join('\n').replace(/\n*$/, '\n');
    const head = fs.existsSync(file) ? '' : `# ${path.basename(file, '.md')}: archived DL entries (grep-only; moved verbatim by decisions.cjs archive)\n\n`;
    fs.appendFileSync(file, head + moved);
    fs.writeFileSync(log, lines.filter((_, i) => !out.has(i)).join('\n'));
  }
  return res;
}

function due(log, today = new Date().toISOString().slice(0, 10)) {
  const all = entries(log);
  const superseded = new Set(all.map((e) => e.fields.Supersedes).filter(Boolean));
  const out = [];
  for (const e of all) {
    if (superseded.has(e.id)) continue;
    const seen = e.outcome.find((o) => /failure[- ]signal seen/i.test(o.text));
    if (seen) out.push(`${e.id} failure signal seen ${seen.date}: ${e.signature}`);
    else if (DATE.test(e.fields['Review-by'] || '') && e.fields['Review-by'] <= today) out.push(`${e.id} review due ${e.fields['Review-by']}: ${e.signature}`);
  }
  return out;
}

// The next free id: one past the highest DL number in the log and its ACTION_LOG-YYYY-MM.md archives, 3 digits.
function nextId(log) {
  const nums = [log, ...archives(log)].flatMap((f) => entries(f).map((e) => Number(e.id.slice(3))));
  return `DL-${String(Math.max(0, ...nums) + 1).padStart(3, "0")}`;
}

function find(log, keywords) {
  const want = [...new Set(keywords.join(' ').toLowerCase().match(/[a-z0-9]{3,}/g) || [])];
  return entries(log)
    .map((e) => {
      const hay = new Set(`${e.signature} ${e.fields.Keywords || ''} ${e.fields.Trigger || ''}`.toLowerCase().match(/[a-z0-9]{3,}/g) || []);
      return { e, score: want.filter((w) => hay.has(w)).length };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.e.id.localeCompare(b.e.id))
    .slice(0, 3)
    .map((x) => `${x.e.id} (score ${x.score}) ${x.e.signature}`);
}

const git = (args, cwd) => cp.spawnSync('git', args, { cwd, encoding: 'utf8' });

function checkPrivate(dir, skill) {
  const d = fs.realpathSync(needDir(dir));
  const problems = [];
  if (skill) {
    const s = fs.realpathSync(needDir(skill));
    const r = path.relative(s, d);
    if (!r || (!r.startsWith('..') && !path.isAbsolute(r))) problems.push('inside the skill folder');
  }
  if (d.split(/[\\/]/).some((p) => p.toLowerCase() === 'skills')) problems.push('under a "skills" folder');
  const inside = git(['rev-parse', '--show-toplevel'], d);
  if (inside.status === 0) {
    const top = inside.stdout.trim();
    const rel = path.relative(fs.realpathSync(top), d).replace(/\\/g, '/') || '.';
    if (git(['ls-files', '--', rel], top).stdout.trim()) problems.push('has files tracked by git');
    else if (git(['check-ignore', '-q', rel], top).status !== 0) problems.push('inside a git repo and not ignored (add it to .gitignore)');
  }
  return problems;
}

function scanTask(arenaDir) {
  needDir(arenaDir);
  const task = path.join(arenaDir, 'task.md');
  if (!fs.existsSync(task)) throw new InputError('task.md missing in ' + arenaDir);
  const files = [task, path.join(arenaDir, 'baseline.md')].filter((f) => fs.existsSync(f));
  const deny = denyRes(process.env.MB_DENY);
  const problems = [];
  for (const f of files) {
    const name = path.basename(f);
    fs.readFileSync(f, 'utf8').split('\n').forEach((l, i) => {
      if (secretRes.some((re) => re.test(l))) problems.push(`${name}:${i + 1}: possible secret (value not shown)`);
      if (deny.some((re) => re.test(l))) problems.push(`${name}:${i + 1}: denied word`);
    });
  }
  return { problems, files: files.map((f) => path.basename(f)) };
}

function pct(v) {
  const n = v === undefined || v === null || String(v).trim() === '' ? NaN : Number(String(v).replace(/%$/, ''));
  return Number.isFinite(n) ? n : 90; // missing, failed or non-numeric: treated as 90
}

function usageGate(five, week, { wave = false } = {}) {
  const p = { five: pct(five), week: pct(week) };
  const acts = new Set();
  for (const w of ['five', 'week']) for (const [t, a] of Object.entries(TABLE[w])) if (p[w] >= Number(t)) a.forEach((x) => acts.add(x));
  const noArena = acts.has('no-arena') || acts.has('stop');
  const refuse = wave ? acts.has('stop') : noArena;
  const said = [acts.has('stop') ? 'stop launching (checkpoint)' : null, noArena ? 'no arena: usage' : 'arena allowed', acts.has('drop') ? 'non-critical work drops 1 tier' : null].filter(Boolean);
  return { refuse, five: p.five, week: p.week, line: `usage-gate: 5-hour ${p.five}%, weekly ${p.week}%: ${said.join('; ')}` };
}

function treeHash(dir, skip = []) {
  const root = path.resolve(needDir(dir));
  const skips = skip.map((s) => path.resolve(s));
  const out = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.name === '.git' || e.name === 'node_modules' || skips.includes(p)) continue;
      if (e.isDirectory()) walk(p);
      else out.push(`${sha(fs.readFileSync(p))} ${path.relative(root, p).replace(/\\/g, '/')}`);
    }
  })(root);
  return out.sort((a, b) => a.slice(65).localeCompare(b.slice(65)));
}

// Arena pre-flight (procedure/05). Each item returns null (ok), 'skip: why', or the failure text.
function preflight(master, o = {}) {
  needDir(master);
  const skill = path.join(__dirname, '..');
  const project = path.resolve(o.project || path.join(master, '..'));
  const arena = path.join(master, 'arena');
  const inRepo = () => git(['rev-parse', '--is-inside-work-tree'], project).status === 0;
  const items = [
    ['arena skill matches its pin', () => {
      const r = cp.spawnSync('node', [path.join(__dirname, 'install-skill.cjs'), '--check', 'arena', ...(o.skillsDir ? ['--skills-dir', o.skillsDir] : [])], { encoding: 'utf8' });
      return r.status === 0 ? null : (r.stderr || r.stdout).trim().split('\n')[0];
    }],
    ['usage allows an arena', () => { const g = usageGate(o.five, o.week); return g.refuse ? g.line : null; }],
  ];
  if (o.yes) items.push(
    ['python 3.8 or newer', () => {
      for (const py of ['python3', 'python']) {
        const m = /Python (\d+)\.(\d+)/.exec(String(cp.spawnSync(py, ['--version'], { encoding: 'utf8' }).stdout || ''));
        if (m) return +m[1] > 3 || (+m[1] === 3 && +m[2] >= 8) ? null : `found Python ${m[1]}.${m[2]}`;
      }
      return 'no python3 or python on PATH';
    }],
    ['arena folder is private', () => { fs.mkdirSync(arena, { recursive: true }); const p = checkPrivate(arena, skill); return p.length ? p.join('; ') : null; }],
    ['.arena/ is ignored by git', () => {
      if (!inRepo()) return 'skip: plain folder, not a git repo';
      const gi = path.join(project, '.gitignore');
      const has = fs.existsSync(gi) && fs.readFileSync(gi, 'utf8').split(/\r?\n/).some((l) => /^\/?\.arena\/?$/.test(l.trim()));
      return has && git(['check-ignore', '-q', '.arena'], project).status === 0 ? null : 'add .arena/ to the project .gitignore (once, with the owner\'s yes)';
    }],
    ['before snapshot written', () => {
      const text = inRepo() ? git(['status', '--porcelain'], project).stdout : treeHash(project, [arena]).join('\n') + '\n';
      fs.writeFileSync(path.join(arena, 'before.txt'), text);
      return null;
    }],
    ['task.md and baseline.md are clean', () => {
      const a = path.join(arena, '.arena');
      if (!fs.existsSync(path.join(a, 'task.md'))) return 'write arena/.arena/task.md first';
      const r = scanTask(a); return r.problems.length ? r.problems.join('; ') : null;
    }]);
  const lines = [];
  for (let i = 0; i < items.length; i++) {
    const res = items[i][1]();
    lines.push(`${i + 1}. ${items[i][0]}: ${res === null ? 'ok' : res.startsWith('skip:') ? res : 'FAIL: ' + res}`);
    if (res !== null && !res.startsWith('skip:')) return { ok: false, lines: lines.concat('no arena: item ' + (i + 1) + ' failed') };
  }
  return { ok: true, lines: lines.concat(o.yes ? 'pre-flight passed: show the bracket plan and its token range' : 'phase A passed: make the offer') };
}

function main(argv) {
  const flag = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
  const flags = (n) => argv.flatMap((a, i) => (a === n ? [argv[i + 1]] : []));
  const [cmd, a] = argv;
  const say = (lines, empty) => console.log(lines.length ? lines.join('\n') : empty);
  if (cmd === 'lint') {
    const r = lint(a);
    if (r.errors.length) { console.log('decisions lint: FAILED\n' + r.errors.join('\n')); return 1; }
    console.log(`decisions lint: ok (${r.count} DL entries)`); return 0;
  }
  if (cmd === 'due') { say(due(a, flag('--today')), 'no decisions due'); return 0; }
  if (cmd === 'next-id') { console.log(nextId(a)); return 0; }
  if (cmd === 'find') { say(find(a, argv.slice(2)), 'no similar entries'); return 0; }
  if (cmd === 'archive') {
    const write = argv.includes('--write');
    const r = archive(a, { max: Number(flag('--max') || 200), today: flag('--today'), write });
    const f = path.basename(r.file);
    if (!r.moved.length) console.log(r.before <= Number(flag('--max') || 200) ? `archive: ${r.before} lines, under the limit; nothing to move`
      : !r.found ? `archive: ${r.before} lines, but no DL entries found (headings "## DL-NNN — ..." or "## DL-NNN · ..."); nothing moved`
      : `archive: ${r.before} lines, but every old entry is still under review (${r.kept.join(', ')}); nothing moved`);
    else console.log(`archive: ${write ? 'moved' : 'would move'} ${r.moved.join(', ')} to ${f}; live log ${r.before} -> ${r.after} lines${r.kept.length ? `; kept under review: ${r.kept.join(', ')}` : ''}${write ? '' : ' (dry run; add --write)'}`);
    return 0;
  }
  if (cmd === 'check-private') {
    const p = checkPrivate(a, flag('--skill'));
    if (p.length) { console.log(`check-private: REFUSED ${a}: ${p.join('; ')}`); return 1; }
    console.log('check-private: ok'); return 0;
  }
  if (cmd === 'scan-task') {
    const r = scanTask(a);
    if (r.problems.length) { console.log('scan-task: REFUSED\n' + r.problems.join('\n')); return 1; }
    console.log(`scan-task: ok (${r.files.join(', ')})`); return 0;
  }
  if (cmd === 'usage-gate') { const r = usageGate(flag('--five'), flag('--week'), { wave: argv.includes('--wave') }); console.log(r.line); return r.refuse ? 1 : 0; }
  if (cmd === 'tree-hash') { say(treeHash(a, flags('--skip')), ''); return 0; }
  if (cmd === 'preflight') {
    const r = preflight(a, { five: flag('--five'), week: flag('--week'), yes: argv.includes('--yes'), project: flag('--project'), skillsDir: flag('--skills-dir') });
    console.log(r.lines.join('\n')); return r.ok ? 0 : 1;
  }
  console.error('usage: decisions.cjs lint|due|find|next-id|archive|check-private|scan-task|usage-gate|tree-hash|preflight ... (see the header)');
  return 2;
}

if (require.main === module) {
  try { process.exit(main(process.argv.slice(2))); }
  catch (e) { console.error('decisions: ' + e.message); process.exit(e instanceof InputError || e.code === 'ENOENT' ? 2 : 1); }
}

module.exports = { lint, due, find, nextId, archive, archives, entries, checkPrivate, scanTask, usageGate, treeHash, preflight, TABLE };
