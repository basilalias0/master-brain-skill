'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const crypto = require('crypto');
const { pathToFileURL } = require('url');

const SCRIPT = path.join(__dirname, 'install-skill.cjs');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mb-is-'));
const git = (a, cwd) => cp.execFileSync('git', a, { cwd, encoding: 'utf8' }).trim();

function setup(skillText) {
  const repo = tmp();
  git(['init', '-q'], repo);
  git(['config', 'user.email', 't@t'], repo);
  git(['config', 'user.name', 't'], repo);
  fs.writeFileSync(path.join(repo, 'SKILL.md'), skillText);
  git(['add', '.'], repo);
  git(['commit', '-qm', 'x'], repo);
  const reg = path.join(tmp(), 'registry.json');
  const entry = { repo: pathToFileURL(repo).href, ref: 'main', sha: git(['rev-parse', 'HEAD'], repo), skillSha256: crypto.createHash('sha256').update(skillText).digest('hex') };
  fs.writeFileSync(reg, JSON.stringify({ allowedOwners: ['o'], skills: { demo: entry } }));
  return { reg, entry, dest: tmp() };
}
const run = (args, env) => cp.spawnSync('node', [SCRIPT, ...args], { encoding: 'utf8', env: { ...process.env, MB_ALLOW_FILE: '1', ...env } });
const SKILL = '---\nname: demo\ndescription: "A demo"\n---\nbody\n';

test('dry run installs nothing; --yes installs', () => {
  const s = setup(SKILL);
  const dry = run(['demo', '--registry', s.reg, '--skills-dir', s.dest]);
  assert.strictEqual(dry.status, 0);
  assert.match(dry.stdout, /DRY RUN/);
  assert.ok(!fs.existsSync(path.join(s.dest, 'demo')));
  const real = run(['demo', '--registry', s.reg, '--skills-dir', s.dest, '--yes']);
  assert.strictEqual(real.status, 0, real.stderr);
  assert.ok(fs.existsSync(path.join(s.dest, 'demo', 'SKILL.md')));
  assert.ok(!fs.existsSync(path.join(s.dest, 'demo', '.git')));
  assert.strictEqual(run(['demo', '--registry', s.reg, '--skills-dir', s.dest, '--yes']).status, 3);
});

test('hash mismatch is refused', () => {
  const s = setup(SKILL);
  const r = JSON.parse(fs.readFileSync(s.reg, 'utf8'));
  r.skills.demo.skillSha256 = 'a'.repeat(64);
  fs.writeFileSync(s.reg, JSON.stringify(r));
  const out = run(['demo', '--registry', s.reg, '--skills-dir', s.dest, '--yes']);
  assert.strictEqual(out.status, 1);
  assert.match(out.stderr, /hash does not match/);
  assert.ok(!fs.existsSync(path.join(s.dest, 'demo')));
});

test('unknown skill, unpinned entry and disallowed repo are refused', () => {
  const s = setup(SKILL);
  assert.strictEqual(run(['nope', '--registry', s.reg, '--skills-dir', s.dest]).status, 2);
  const r = JSON.parse(fs.readFileSync(s.reg, 'utf8'));
  r.skills.bad = { repo: 'https://github.com/evil/x.git', ref: 'main', sha: 'a'.repeat(40), skillSha256: 'b'.repeat(64) };
  r.skills.unpinned = { repo: 'https://github.com/o/x.git', ref: 'unpublished', sha: '', skillSha256: '' };
  fs.writeFileSync(s.reg, JSON.stringify(r));
  assert.match(run(['bad', '--registry', s.reg, '--skills-dir', s.dest, '--yes'], { MB_ALLOW_FILE: '0' }).stderr, /allowed GitHub owner/);
  assert.match(run(['unpinned', '--registry', s.reg, '--skills-dir', s.dest]).stderr, /not pinned/);
});
