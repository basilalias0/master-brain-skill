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

function card(id, o = {}) {
  const f = { Keywords: 'cache, queue', Date: '2026-09-01', Question: 'Which queue for jobs?', Options: 'A; B', Criteria: 'cost 50, effort 50',
    Evidence: 'two public write-ups', 'Inspired-by': 'public docs', Decision: 'A', Confidence: '70', Arena: 'none',
    'Review-by': '2026-12-01', 'Failure-signal': 'p95 over 2s', Share: 'project', Supersedes: 'none', ...o.fields };
  const head = [`## ${id} — ${o.sig || 'queue choice'}`, ...Object.entries(f).filter(([, v]) => v !== null).map(([k, v]) => `${k}: ${v}`)];
  return head.concat(o.tail || []).join('\n') + '\n';
}
function bank(cards) {
  const b = tmp();
  for (const [id, text] of Object.entries(cards)) fs.writeFileSync(path.join(b, id + '.md'), text);
  return b;
}

test('lint rejects a card missing review-by or failure signal', () => {
  const b = bank({ 'DC-001': card('DC-001', { fields: { 'Review-by': null } }), 'DC-002': card('DC-002', { fields: { 'Failure-signal': null } }), 'DC-003': card('DC-003') });
  const r = run(['lint', b]);
  assert.strictEqual(r.status, 1);
  assert.match(r.stdout, /DC-001: missing Review-by/);
  assert.match(r.stdout, /DC-002: missing Failure-signal/);
  assert.doesNotMatch(r.stdout, /DC-003/);
  assert.strictEqual(run(['lint', path.join(b, 'nope')]).status, 2);
});

test('due lists only past-review and failure-seen cards', () => {
  const b = bank({
    'DC-001': card('DC-001', { fields: { 'Review-by': '2026-10-01' } }),
    'DC-002': card('DC-002', { tail: ['Outcome 2026-10-05: failure-signal seen — p95 3s'] }),
    'DC-003': card('DC-003'),
    'DC-004': card('DC-004', { fields: { 'Review-by': '2026-10-01' }, tail: ['Status 2026-10-02: superseded-by DC-003 — replaced'] }),
  });
  const out = d.due(b, '2026-10-19');
  assert.deepStrictEqual(out.map((l) => l.split(' ')[0]), ['DC-001', 'DC-002']);
  assert.match(out[1], /failure signal seen 2026-10-05/);
});

test('edited card head is refused', () => {
  const b = bank({ 'DC-001': card('DC-001') });
  assert.strictEqual(run(['lint', b]).status, 0);
  assert.ok(JSON.parse(fs.readFileSync(path.join(b, '.index.json'), 'utf8')).cards['DC-001']);
  fs.appendFileSync(path.join(b, 'DC-001.md'), 'Status 2026-10-10: under-review — new numbers\n');
  assert.strictEqual(run(['lint', b]).status, 0, 'appending a Status line is allowed');
  fs.writeFileSync(path.join(b, 'DC-001.md'), card('DC-001', { fields: { Decision: 'B' } }));
  const r = run(['lint', b]);
  assert.strictEqual(r.status, 1);
  assert.match(r.stdout, /head was edited/);
});

test('superseded-by must name an existing card', () => {
  const b = bank({ 'DC-001': card('DC-001', { tail: ['Status 2026-10-10: superseded-by DC-009 — moved'] }) });
  const r = run(['lint', b]);
  assert.strictEqual(r.status, 1);
  assert.match(r.stdout, /superseded-by names a card that does not exist: DC-009/);
  fs.writeFileSync(path.join(b, 'DC-009.md'), card('DC-009', { fields: { Supersedes: 'DC-001' } }));
  assert.strictEqual(run(['lint', b]).status, 0);
});

test('check-private refuses a bank inside the skill', () => {
  const skill = tmp();
  const inside = path.join(skill, 'master-brain', 'decisions');
  fs.mkdirSync(inside, { recursive: true });
  const r = run(['check-private', inside, '--skill', skill]);
  assert.strictEqual(r.status, 1);
  assert.match(r.stdout, /inside the skill folder/);
  const outside = tmp();
  assert.strictEqual(run(['check-private', outside, '--skill', skill]).status, 0);
  assert.strictEqual(run(['check-private', path.join(outside, 'missing'), '--skill', skill]).status, 2);
});

test('check-private refuses a git-tracked, non-ignored bank', () => {
  const repo = tmp();
  git(['init', '-q'], repo); git(['config', 'user.email', 't@t'], repo); git(['config', 'user.name', 't'], repo);
  const b = path.join(repo, 'master-brain', 'decisions');
  fs.mkdirSync(b, { recursive: true });
  fs.writeFileSync(path.join(b, 'DC-001.md'), card('DC-001'));
  const notIgnored = run(['check-private', b]);
  assert.strictEqual(notIgnored.status, 1);
  assert.match(notIgnored.stdout, /not ignored/);
  fs.writeFileSync(path.join(repo, '.gitignore'), 'master-brain/\n');
  assert.strictEqual(run(['check-private', b]).status, 0);
  git(['add', '-f', 'master-brain/decisions/DC-001.md'], repo);
  git(['commit', '-qm', 'x'], repo);
  const tracked = run(['check-private', b]);
  assert.strictEqual(tracked.status, 1);
  assert.match(tracked.stdout, /tracked by git/);
});

function arena(task, baseline) {
  const master = tmp();
  const a = path.join(master, 'arena', '.arena');
  fs.mkdirSync(a, { recursive: true });
  fs.mkdirSync(path.join(master, 'decisions'));
  fs.writeFileSync(path.join(master, 'decisions', 'DC-001.md'), card('DC-001'));
  if (task !== null) fs.writeFileSync(path.join(a, 'task.md'), task);
  if (baseline) fs.writeFileSync(path.join(a, 'baseline.md'), baseline);
  return a;
}
const owner = () => { const o = tmp(); fs.writeFileSync(path.join(o, 'DC-050.md'), card('DC-050', { fields: { Share: 'owner-wide' } })); fs.writeFileSync(path.join(o, 'DC-051.md'), card('DC-051')); return o; };

test('scan-task refuses a key-like string', () => {
  const key = ['sk', 'A1b2C3d4E5f6G7h8I9j0K1l2'].join('-');
  const bad = run(['scan-task', arena(`# Task\nUse the key ${key} to call the API\n`), '--owner-bank', owner()]);
  assert.strictEqual(bad.status, 1);
  assert.match(bad.stdout, /task\.md:2: possible secret/);
  assert.ok(!bad.stdout.includes(key));
  const o = owner();
  assert.strictEqual(run(['scan-task', arena('# Task\nSee DC-001 and DC-050\n'), '--owner-bank', o]).status, 0);
  assert.match(run(['scan-task', arena('# Task\nSee DC-051\n'), '--owner-bank', o]).stdout, /DC-051 is not this project's card/);
  assert.strictEqual(run(['scan-task', arena(null), '--owner-bank', o]).status, 2);
});

test('scan-task scans the baseline file too', () => {
  const o = owner();
  const r = run(['scan-task', arena('# Task\nclean\n', 'rejected answer naming Acme Corp\n'), '--owner-bank', o], { MB_DENY: 'acme' });
  assert.strictEqual(r.status, 1);
  assert.match(r.stdout, /baseline\.md:1: denied word/);
  const ok = run(['scan-task', arena('# Task\nclean\n', 'a plain rejected answer\n'), '--owner-bank', o], { MB_DENY: 'acme' });
  assert.strictEqual(ok.status, 0);
  assert.match(ok.stdout, /task\.md, baseline\.md/);
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
