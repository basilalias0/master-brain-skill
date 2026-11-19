'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const d = require('./decisions.cjs');

const S = path.join(__dirname, 'decisions.cjs');
const run = (args, env) => cp.spawnSync('node', [S, ...args], { encoding: 'utf8', env: { ...process.env, ...env } });
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mb-dc-'));
const git = (a, cwd) => cp.execFileSync('git', a, { cwd, encoding: 'utf8' });

function entry(id, o = {}) {
  const f = { Keywords: 'cache, queue', Type: 'Architecture-Decision', 'First seen': 'jobs, 2026-09-01', Trigger: 'Which queue for jobs?',
    'Decision/Fix': 'A', 'Reuse signature': 'queue choice', Confidence: '70', 'Review-by': '2026-12-01', 'Failure-signal': 'p95 over 2s', ...o.fields };
  return [`## ${id} — ${o.sig || 'queue choice'}`, ...Object.entries(f).filter(([, v]) => v !== null).map(([k, v]) => `${k}: ${v}`), ...(o.tail || []), ''].join('\n');
}
function log(...es) {
  const f = path.join(tmp(), 'ACTION_LOG.md');
  fs.writeFileSync(f, fs.readFileSync(path.join(__dirname, '..', 'templates', 'ACTION_LOG.md'), 'utf8') + es.join('\n'));
  return f;
}

test('lint checks the optional decision fields and Supersedes; the template alone is clean', () => {
  assert.strictEqual(run(['lint', log()]).status, 0);
  const bad = run(['lint', log(entry('DL-001', { fields: { Confidence: '140' } }), entry('DL-002', { fields: { 'Review-by': 'soon', Supersedes: 'DL-009' } }), entry('DL-003', { fields: { Confidence: null } }))]);
  assert.strictEqual(bad.status, 1);
  assert.match(bad.stdout, /DL-001: Confidence must be 0-100/);
  assert.match(bad.stdout, /DL-002: Review-by must be YYYY-MM-DD/);
  assert.match(bad.stdout, /DL-002: Supersedes names an entry that does not exist: DL-009/);
  assert.doesNotMatch(bad.stdout, /DL-003/);
  assert.strictEqual(run(['lint', path.join(tmp(), 'nope.md')]).status, 2);
});

test('due lists only past-review and failure-seen entries, never superseded ones', () => {
  const f = log(
    entry('DL-001', { fields: { 'Review-by': '2026-10-01' } }),
    entry('DL-002', { tail: ['Outcome 2026-10-05: failure-signal seen — p95 3s'] }),
    entry('DL-003'),
    entry('DL-004', { fields: { 'Review-by': '2026-10-01' } }),
    entry('DL-005', { fields: { Supersedes: 'DL-004', 'Review-by': null } }),
  );
  const out = d.due(f, '2026-10-19');
  assert.deepStrictEqual(out.map((l) => l.split(' ')[0]), ['DL-001', 'DL-002']);
  assert.match(out[1], /failure signal seen 2026-10-05/);
});

test('find returns the top matches by keyword', () => {
  const f = log(entry('DL-001', { sig: 'login cookie expiry', fields: { Keywords: 'auth', Trigger: 'logout' } }), entry('DL-002', { sig: 'queue choice' }));
  assert.match(run(['find', f, 'which', 'queue']).stdout, /^DL-002 \(score/);
  assert.match(run(['find', f, 'nothing']).stdout, /no similar entries/);
});

test('archive moves the oldest entries verbatim, keeps those under review, and is a dry run without --write', () => {
  const old = (id) => entry(id, { fields: { 'Review-by': null, Confidence: null, 'Failure-signal': null } });
  const f = log(old('DL-001'), entry('DL-002', { fields: { 'Review-by': '2026-12-31' } }), old('DL-003'), old('DL-004'),
    entry('DL-005', { fields: { Supersedes: 'DL-001', 'Review-by': null } }));
  const before = fs.readFileSync(f, 'utf8');
  const n = before.split('\n').length;
  const max = String(n - 12);
  const dry = run(['archive', f, '--max', max, '--today', '2026-11-19']);
  assert.strictEqual(dry.status, 0);
  assert.match(dry.stdout, /would move DL-001, DL-003 to ACTION_LOG-2026-11\.md.*kept under review: DL-002.*dry run/);
  assert.strictEqual(fs.readFileSync(f, 'utf8'), before);
  assert.match(run(['archive', f, '--max', max, '--today', '2026-11-19', '--write']).stdout, /^archive: moved DL-001, DL-003/);
  const live = fs.readFileSync(f, 'utf8');
  const arch = fs.readFileSync(path.join(path.dirname(f), 'ACTION_LOG-2026-11.md'), 'utf8');
  assert.ok(live.split('\n').length <= Number(max));
  assert.doesNotMatch(live, /DL-001 —|DL-003 —/);
  assert.match(live, /DL-002 —[\s\S]*DL-004 —[\s\S]*DL-005 —/);
  assert.ok(arch.includes(old('DL-001').trim()) && arch.includes(old('DL-003').trim()));
  assert.strictEqual(run(['lint', f]).status, 0, 'Supersedes may name an archived entry');
  assert.match(run(['archive', f, '--today', '2026-11-19']).stdout, /under the limit; nothing to move/);
});

test('the older "## DL-NNN · date · title" headings are read by lint, find and archive', () => {
  const f = path.join(tmp(), 'ACTION_LOG.md');
  const old = (n, title) => `## DL-00${n} · 2026-11-0${n} · ${title}\n\nFound: ${title} details.\n### Notes\nmore text\n\n`;
  fs.writeFileSync(f, '# Action log (X)\n\n' + old(1, 'Onboarded') + old(2, 'Attendance researched') + old(3, 'Queue choice'));
  assert.match(run(['lint', f]).stdout, /ok \(3 DL entries\)/);
  assert.match(run(['find', f, 'attendance']).stdout, /^DL-002 /);
  const n = fs.readFileSync(f, 'utf8').split('\n').length;
  assert.match(run(['archive', f, '--max', String(n - 6), '--today', '2026-11-19', '--write']).stdout, /^archive: moved DL-001 to ACTION_LOG-2026-11\.md/);
  const live = fs.readFileSync(f, 'utf8');
  assert.match(live, /^# Action log \(X\)/);
  assert.doesNotMatch(live, /DL-001 ·/);
  assert.match(fs.readFileSync(path.join(path.dirname(f), 'ACTION_LOG-2026-11.md'), 'utf8'), /## DL-001 · 2026-11-01 · Onboarded[\s\S]*### Notes\nmore text/);
});

test('archive says so when a long log has no DL headings it can read', () => {
  const f = path.join(tmp(), 'ACTION_LOG.md');
  fs.writeFileSync(f, '# Log\n' + '## DL-1: no separator\nline\n'.repeat(120));
  assert.match(run(['archive', f]).stdout, /no DL entries found .*nothing moved/);
});

test('check-private refuses an arena folder inside the skill', () => {
  const skill = tmp();
  const inside = path.join(skill, 'master-brain', 'arena');
  fs.mkdirSync(inside, { recursive: true });
  const r = run(['check-private', inside, '--skill', skill]);
  assert.strictEqual(r.status, 1);
  assert.match(r.stdout, /inside the skill folder/);
  const outside = tmp();
  assert.strictEqual(run(['check-private', outside, '--skill', skill]).status, 0);
  assert.strictEqual(run(['check-private', path.join(outside, 'missing'), '--skill', skill]).status, 2);
});

test('check-private refuses a git-tracked, non-ignored folder', () => {
  const repo = tmp();
  git(['init', '-q'], repo); git(['config', 'user.email', 't@t'], repo); git(['config', 'user.name', 't'], repo);
  const b = path.join(repo, 'master-brain', 'arena');
  fs.mkdirSync(b, { recursive: true });
  fs.writeFileSync(path.join(b, 'before.txt'), 'x\n');
  const notIgnored = run(['check-private', b]);
  assert.strictEqual(notIgnored.status, 1);
  assert.match(notIgnored.stdout, /not ignored/);
  fs.writeFileSync(path.join(repo, '.gitignore'), 'master-brain/\n');
  assert.strictEqual(run(['check-private', b]).status, 0);
  git(['add', '-f', 'master-brain/arena/before.txt'], repo);
  git(['commit', '-qm', 'x'], repo);
  const tracked = run(['check-private', b]);
  assert.strictEqual(tracked.status, 1);
  assert.match(tracked.stdout, /tracked by git/);
});

function arena(task, baseline) {
  const a = path.join(tmp(), 'arena', '.arena');
  fs.mkdirSync(a, { recursive: true });
  if (task !== null) fs.writeFileSync(path.join(a, 'task.md'), task);
  if (baseline) fs.writeFileSync(path.join(a, 'baseline.md'), baseline);
  return a;
}

test('scan-task refuses a key-like string', () => {
  const key = ['sk', 'A1b2C3d4E5f6G7h8I9j0K1l2'].join('-');
  const bad = run(['scan-task', arena(`# Task\nUse the key ${key} to call the API\n`)]);
  assert.strictEqual(bad.status, 1);
  assert.match(bad.stdout, /task\.md:2: possible secret/);
  assert.ok(!bad.stdout.includes(key));
  assert.strictEqual(run(['scan-task', arena('# Task\nSee DL-001\n')]).status, 0);
  assert.strictEqual(run(['scan-task', arena(null)]).status, 2);
});

test('scan-task scans the baseline file too', () => {
  const r = run(['scan-task', arena('# Task\nclean\n', 'rejected answer naming Acme Corp\n')], { MB_DENY: 'acme' });
  assert.strictEqual(r.status, 1);
  assert.match(r.stdout, /baseline\.md:1: denied word/);
  const ok = run(['scan-task', arena('# Task\nclean\n', 'a plain rejected answer\n')], { MB_DENY: 'acme' });
  assert.strictEqual(ok.status, 0);
  assert.match(ok.stdout, /task\.md, baseline\.md/);
});

test('preflight phase A names the failed item and stops there', () => {
  const master = path.join(tmp(), 'master-brain');
  fs.mkdirSync(master);
  const none = run(['preflight', master, '--five', '10', '--week', '10', '--skills-dir', tmp()]);
  assert.strictEqual(none.status, 1);
  assert.match(none.stdout, /1\. arena skill matches its pin: FAIL/);
  assert.match(none.stdout, /no arena: item 1 failed/);
  assert.doesNotMatch(none.stdout, /^2\./m, 'stops at the first failed item');
  assert.strictEqual(d.preflight(master, { five: 10, week: 75, skillsDir: tmp() }).ok, false);
  assert.strictEqual(run(['preflight', path.join(master, 'nope')]).status, 2);
});

test('usage-gate refuses arena at 70% weekly or 5-hour', () => {
  assert.strictEqual(run(['usage-gate', '--five', '69', '--week', '69']).status, 0);
  const w = run(['usage-gate', '--five', '10', '--week', '70']);
  assert.strictEqual(w.status, 1);
  assert.match(w.stdout, /no arena: usage/);
  const f = run(['usage-gate', '--five', '70', '--week', '10']);
  assert.strictEqual(f.status, 1);
  assert.match(f.stdout, /drops 1 tier/);
  assert.strictEqual(run(['usage-gate', '--five', '75', '--week', '85', '--wave']).status, 0, 'between waves only the 90% column stops');
});

test('usage-gate stops at 90%', () => {
  for (const args of [['--five', '90', '--week', '0'], ['--five', '0', '--week', '95']]) {
    const r = run(['usage-gate', ...args, '--wave']);
    assert.strictEqual(r.status, 1);
    assert.match(r.stdout, /stop launching/);
  }
});

test('usage-gate treats a missing value as 90%', () => {
  const r = run(['usage-gate', '--five', '10', '--wave']);
  assert.strictEqual(r.status, 1);
  assert.match(r.stdout, /weekly 90%/);
  assert.strictEqual(d.usageGate('n/a', '5').five, 90);
});

test('tree-hash detects a new file outside the arena folder', () => {
  const p = tmp();
  const skip = path.join(p, 'master-brain', 'arena');
  fs.mkdirSync(skip, { recursive: true });
  fs.writeFileSync(path.join(p, 'a.txt'), 'a\n');
  const before = d.treeHash(p, [skip]);
  fs.writeFileSync(path.join(skip, 'run.json'), '{}\n');
  assert.deepStrictEqual(d.treeHash(p, [skip]), before);
  fs.writeFileSync(path.join(p, 'b.txt'), 'b\n');
  const after = run(['tree-hash', p, '--skip', skip]).stdout.trim().split('\n');
  assert.notDeepStrictEqual(after, before);
  assert.ok(after.some((l) => / b\.txt$/.test(l)));
});

test('usage numbers agree in TOKENS, law 14 and usage-gate', () => {
  const root = path.join(__dirname, '..');
  const lines = fs.readFileSync(path.join(root, 'core', 'TOKENS.md'), 'utf8').split('\n');
  const head = lines.find((l) => /^\| Window \(`get_usage`\)/.test(l));
  assert.ok(head, 'TOKENS section 6 has the usage table');
  const cols = head.split('|').slice(2, -1).map((c) => Number(/(\d+)%/.exec(c)[1]));
  const act = (cell) => [[/drops 1 tier/, 'drop'], [/no arena/, 'no-arena'], [/stop launching/, 'stop']].filter(([re]) => re.test(cell)).map(([, a]) => a).sort();
  const table = {};
  for (const [key, label] of [['five', '5-hour'], ['week', 'weekly']]) {
    const row = lines.find((l) => l.startsWith(`| ${label} |`));
    assert.ok(row, label + ' row');
    table[key] = {};
    row.split('|').slice(2, -1).forEach((c, i) => { const a = act(c); if (a.length) table[key][cols[i]] = a; });
  }
  const norm = (t) => JSON.parse(JSON.stringify(t, (k, v) => (Array.isArray(v) ? [...v].sort() : v)));
  assert.deepStrictEqual(table, norm(d.TABLE));
  const laws = fs.readFileSync(path.join(root, 'templates', 'LAWS.md'), 'utf8').split('\n');
  const i = laws.findIndex((l) => l.startsWith('14. '));
  const law14 = laws.slice(i, i + laws.slice(i + 1).findIndex((l) => /^\d+\. /.test(l)) + 1).join('\n');
  assert.match(law14, /TOKENS §6/);
  assert.match(law14, /weekly/);
  assert.doesNotMatch(law14, /\d+\s*%/);
});
