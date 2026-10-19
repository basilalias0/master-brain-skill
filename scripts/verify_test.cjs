'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

const S = path.join(__dirname, 'verify.cjs');
const run = (d, env) => cp.spawnSync('node', [S, d], { encoding: 'utf8', env: { ...process.env, ...env } });
function repo(extra = {}) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mb-vf-'));
  fs.writeFileSync(path.join(d, 'SKILL.md'), '---\nname: demo\ndescription: "Does a thing"\n---\n# demo\n');
  for (const [k, v] of Object.entries(extra)) { fs.mkdirSync(path.dirname(path.join(d, k)), { recursive: true }); fs.writeFileSync(path.join(d, k), v); }
  return d;
}

test('a clean repo passes', () => {
  assert.strictEqual(run(repo()).status, 0);
});

test('multi-line description, long description and bad link fail', () => {
  const d = repo({ 'a.md': '[x](missing.md)\n' });
  fs.writeFileSync(path.join(d, 'SKILL.md'), '---\nname: demo\ndescription: >\n  folded\n---\n');
  const r = run(d);
  assert.strictEqual(r.status, 1);
  assert.match(r.stdout, /single-line/);
  assert.match(r.stdout, /broken link/);
});

test('absolute path, model name and secret-shaped text fail without printing values', () => {
  const key = ['-----BEGIN', 'PRIVATE KEY-----'].join(' RSA ');
  const d = repo({ 'x.md': `see C:\\Users\\someone\\x\nuse ${['Son', 'net'].join('')} ${['Op', 'us'].join('')}\n${key}\n` });
  const r = run(d);
  assert.strictEqual(r.status, 1);
  assert.match(r.stdout, /absolute local path/);
  assert.match(r.stdout, /possible secret/);
  assert.ok(!r.stdout.includes('BEGIN'));
});

test('exempt folder is skipped and deny words are caught', () => {
  const d = repo({ 'third/big.md': 'x\n'.repeat(300), '.lintexempt': 'third\n', 'n.md': 'Acme Corp\n' });
  assert.strictEqual(run(d).status, 0);
  assert.strictEqual(run(d, { MB_DENY: 'acme' }).status, 1);
});

test('decision card or .arena inside the skill fails', () => {
  const card = repo({ 'notes/x.md': ['# notes', '## DC-001 — a card'].join('\n') + '\n' });
  const r = run(card);
  assert.strictEqual(r.status, 1);
  assert.match(r.stdout, /decision card inside the skill/);
  assert.strictEqual(run(repo({ '.arena/run1/arena.json': '{}\n' })).status, 1);
  const bank = run(repo({ 'master-brain/decisions/README.txt': 'x\n' }));
  assert.strictEqual(bank.status, 1);
  assert.match(bank.stdout, /private folder inside the skill/);
  assert.strictEqual(run(repo({ 'notes/y.md': 'cards are named DC-NNN and cited as See: DC-001\n' })).status, 0);
});
