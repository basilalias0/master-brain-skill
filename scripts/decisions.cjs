#!/usr/bin/env node
'use strict';
// decisions.cjs: the private decision bank and the arena guards. Zero model tokens. Rules: procedure/05.
//   lint <bank>                        cards are complete, ids exist, heads unchanged; records new heads in <bank>/.index.json
//   due <bank> [--today D]             cards past Review-by or with a failure signal seen
//   find <bank> <keywords...> [--shared]   top 3 cards by keyword overlap (--shared: owner-wide cards only)
//   check-private <dir> --skill <root> the folder is outside the skill, not under a `skills` folder, not tracked by git
//   scan-task <arena dir> [--bank B] [--owner-bank B]   task.md (+ baseline.md) hold no secrets, denied words or foreign cards
//   usage-gate --five <pct> --week <pct> [--wave]       the TOKENS section 6 table; a missing value counts as 90
//   tree-hash <dir> [--skip <dir>]...  one "<sha256> <path>" line per file, for before/after snapshots
// A card is DC-NNN.md: a "## DC-NNN — <signature>" heading, the FIELDS below, then only appended Status and Outcome lines.
// Exit: 0 ok, 1 refused or lint errors, 2 unreadable input or usage.
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const cp = require('child_process');
const { secretRes, denyRes } = require('./verify.cjs');

const FIELDS = ['Keywords', 'Date', 'Question', 'Options', 'Criteria', 'Evidence', 'Inspired-by', 'Decision', 'Confidence',
  'Arena', 'Review-by', 'Failure-signal', 'Share', 'Supersedes'];
// TOKENS section 6 usage table: window -> threshold -> actions. The C5 test checks this equals the table in core/TOKENS.md.
const TABLE = { five: { 70: ['drop', 'no-arena'], 90: ['stop'] }, week: { 70: ['no-arena'], 80: ['drop'], 90: ['stop'] } };
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const STATUS = /^Status (\d{4}-\d{2}-\d{2}): (active|under-review|superseded-by (DC-\d+)|failed)(?: — .*)?$/;
const OUTCOME = /^Outcome (\d{4}-\d{2}-\d{2}): \S/;

class InputError extends Error {}
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const needDir = (d) => { if (!d || !fs.existsSync(d) || !fs.statSync(d).isDirectory()) throw new InputError('not a readable folder: ' + d); return d; };

function parseCard(file) {
  const text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const lines = text.split('\n');
  const tail = lines.findIndex((l) => /^(?:Status|Outcome) /.test(l));
  const headLines = tail < 0 ? lines : lines.slice(0, tail);
  const h = /^## (DC-\d+) — (.+)$/.exec(headLines.find((l) => l.startsWith('## ')) || '');
  const c = { file, id: h ? h[1] : null, signature: h ? h[2].trim() : '', fields: {}, status: [], outcome: [], extra: [] };
  c.head = sha(headLines.join('\n').trim());
  for (const l of headLines) { const m = /^([A-Z][A-Za-z-]+): ?(.*)$/.exec(l); if (m) c.fields[m[1]] = m[2].trim(); }
  for (const l of tail < 0 ? [] : lines.slice(tail)) {
    if (!l.trim()) continue;
    const s = STATUS.exec(l); const o = OUTCOME.exec(l);
    if (s) c.status.push({ date: s[1], state: s[2], target: s[3] || null }); else if (o) c.outcome.push({ date: o[1], text: l }); else c.extra.push(l);
  }
  c.state = c.status.length ? c.status[c.status.length - 1].state : 'active';
  return c;
}

function cards(bank) {
  needDir(bank);
  return fs.readdirSync(bank).filter((f) => /^DC-\d+\.md$/.test(f)).sort().map((f) => parseCard(path.join(bank, f)));
}

function lint(bank, { write = true } = {}) {
  const all = cards(bank);
  const ids = new Set(all.map((c) => c.id).filter(Boolean));
  const idxFile = path.join(bank, '.index.json');
  const idx = fs.existsSync(idxFile) ? JSON.parse(fs.readFileSync(idxFile, 'utf8')) : { cards: {} };
  const errors = [];
  let added = 0;
  for (const c of all) {
    const name = path.basename(c.file, '.md');
    const e = (m) => errors.push(`${name}: ${m}`);
    const before = errors.length;
    if (c.id !== name) e('heading must be "## ' + name + ' — <signature>"');
    for (const f of FIELDS) if (!c.fields[f]) e(`missing ${f}`);
    if (c.fields.Date && !DATE.test(c.fields.Date)) e('Date must be YYYY-MM-DD');
    if (c.fields['Review-by'] && !DATE.test(c.fields['Review-by'])) e('Review-by must be YYYY-MM-DD');
    const conf = c.fields.Confidence;
    if (conf && !(/^\d{1,3}$/.test(conf) && Number(conf) <= 100)) e('Confidence must be 0-100');
    if (c.fields.Share && !['project', 'owner-wide'].includes(c.fields.Share)) e('Share must be project or owner-wide');
    const sup = c.fields.Supersedes;
    if (sup && sup !== 'none' && !ids.has(sup)) e(`Supersedes names a card that does not exist: ${sup}`);
    for (const s of c.status) if (s.target && !ids.has(s.target)) e(`superseded-by names a card that does not exist: ${s.target}`);
    for (const x of c.extra) e('only "Status YYYY-MM-DD: ..." and "Outcome YYYY-MM-DD: ..." lines may follow the head: ' + x.slice(0, 40));
    if (idx.cards[name] && idx.cards[name] !== c.head) e('card head was edited after it was recorded (append a Status or Outcome line, or write a new card with Supersedes)');
    if (!idx.cards[name] && errors.length === before) { idx.cards[name] = c.head; added++; }
  }
  if (added && write) fs.writeFileSync(idxFile, JSON.stringify(idx, null, 1) + '\n');
  return { errors, count: all.length, added };
}

function due(bank, today = new Date().toISOString().slice(0, 10)) {
  const out = [];
  for (const c of cards(bank)) {
    if (/^superseded-by|^failed$/.test(c.state)) continue;
    const seen = c.outcome.find((o) => /failure[- ]signal seen/i.test(o.text));
    if (seen) out.push(`${c.id} failure signal seen ${seen.date}: ${c.signature}`);
    else if (c.fields['Review-by'] && c.fields['Review-by'] <= today) out.push(`${c.id} review due ${c.fields['Review-by']}: ${c.signature}`);
  }
  return out;
}

function find(bank, keywords, { shared = false } = {}) {
  const want = [...new Set(keywords.join(' ').toLowerCase().match(/[a-z0-9]{3,}/g) || [])];
  return cards(bank)
    .filter((c) => !shared || c.fields.Share === 'owner-wide')
    .map((c) => {
      const hay = new Set(`${c.signature} ${c.fields.Keywords || ''} ${c.fields.Question || ''}`.toLowerCase().match(/[a-z0-9]{3,}/g) || []);
      return { c, score: want.filter((w) => hay.has(w)).length };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.c.id.localeCompare(b.c.id))
    .slice(0, 3)
    .map((x) => `${x.c.id} (score ${x.score}) ${x.c.signature}`);
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

function cardIndex(bank) {
  if (!bank || !fs.existsSync(bank)) return new Map();
  return new Map(cards(bank).map((c) => [c.id, c.fields.Share || 'project']));
}

function scanTask(arenaDir, { bank, ownerBank } = {}) {
  needDir(arenaDir);
  const task = path.join(arenaDir, 'task.md');
  if (!fs.existsSync(task)) throw new InputError('task.md missing in ' + arenaDir);
  const files = [task, path.join(arenaDir, 'baseline.md')].filter((f) => fs.existsSync(f));
  const own = cardIndex(bank || path.resolve(arenaDir, '..', '..', 'decisions'));
  const wide = cardIndex(ownerBank || path.join(os.homedir(), '.claude', 'master-brain-private', 'decisions'));
  const deny = denyRes(process.env.MB_DENY);
  const problems = [];
  for (const f of files) {
    const name = path.basename(f);
    fs.readFileSync(f, 'utf8').split('\n').forEach((l, i) => {
      if (secretRes.some((re) => re.test(l))) problems.push(`${name}:${i + 1}: possible secret (value not shown)`);
      if (deny.some((re) => re.test(l))) problems.push(`${name}:${i + 1}: denied word`);
      for (const m of l.matchAll(/\bDC-\d+\b/g)) {
        if (!own.has(m[0]) && wide.get(m[0]) !== 'owner-wide') problems.push(`${name}:${i + 1}: ${m[0]} is not this project's card or an owner-wide card`);
      }
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

function main(argv) {
  const flag = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
  const flags = (n) => argv.flatMap((a, i) => (a === n ? [argv[i + 1]] : []));
  const [cmd, a] = argv;
  const say = (lines, empty) => console.log(lines.length ? lines.join('\n') : empty);
  if (cmd === 'lint') {
    const r = lint(a);
    if (r.errors.length) { console.log('decisions lint: FAILED\n' + r.errors.join('\n')); return 1; }
    console.log(`decisions lint: ok (${r.count} cards, ${r.added} newly recorded)`); return 0;
  }
  if (cmd === 'due') { say(due(a, flag('--today')), 'no cards due'); return 0; }
  if (cmd === 'find') { say(find(a, argv.slice(2).filter((x) => x !== '--shared'), { shared: argv.includes('--shared') }), 'no similar cards'); return 0; }
  if (cmd === 'check-private') {
    const p = checkPrivate(a, flag('--skill'));
    if (p.length) { console.log(`check-private: REFUSED ${a}: ${p.join('; ')}`); return 1; }
    console.log('check-private: ok'); return 0;
  }
  if (cmd === 'scan-task') {
    const r = scanTask(a, { bank: flag('--bank'), ownerBank: flag('--owner-bank') });
    if (r.problems.length) { console.log('scan-task: REFUSED\n' + r.problems.join('\n')); return 1; }
    console.log(`scan-task: ok (${r.files.join(', ')})`); return 0;
  }
  if (cmd === 'usage-gate') { const r = usageGate(flag('--five'), flag('--week'), { wave: argv.includes('--wave') }); console.log(r.line); return r.refuse ? 1 : 0; }
  if (cmd === 'tree-hash') { say(treeHash(a, flags('--skip')), ''); return 0; }
  console.error('usage: decisions.cjs lint|due|find|check-private|scan-task|usage-gate|tree-hash ... (see the header)');
  return 2;
}

if (require.main === module) {
  try { process.exit(main(process.argv.slice(2))); }
  catch (e) { console.error('decisions: ' + e.message); process.exit(e instanceof InputError || e.code === 'ENOENT' ? 2 : 1); }
}

module.exports = { lint, due, find, checkPrivate, scanTask, usageGate, treeHash, parseCard, TABLE, FIELDS };
