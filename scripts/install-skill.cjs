#!/usr/bin/env node
'use strict';
// install-skill.cjs <name> [--registry FILE] [--skills-dir DIR] [--yes] [--force]
// Installs a registry skill at its pinned commit. Without --yes it only prints the plan (dry run).
// Env: MB_SKILLS_DIR (destination), MB_ALLOW_FILE=1 (tests only: allow file:// repos).
// Exit: 0 ok or dry run, 1 refused (hash/pin/policy), 2 usage or unknown skill, 3 already installed.
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const cp = require('child_process');

const MAX_BYTES = 2 * 1024 * 1024;
const die = (code, msg) => { console.error('install-skill: ' + msg); process.exit(code); };
const sha256 = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const git = (args, cwd) => cp.execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

function files(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '.git') continue;
    const p = path.join(dir, e.name);
    if (fs.lstatSync(p).isSymbolicLink()) die(1, 'refusing: symlink in repo: ' + e.name);
    if (e.isDirectory()) files(p, out); else out.push(p);
  }
  return out;
}

function frontmatter(f) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(fs.readFileSync(f, 'utf8'));
  const get = (k) => { const r = new RegExp('^' + k + ':\\s*(.*)$', 'm').exec(m ? m[1] : ''); return r ? r[1].replace(/^"|"$/g, '') : ''; };
  return { name: get('name'), description: get('description') };
}

function main() {
  const argv = process.argv.slice(2);
  const flag = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
  const name = argv.find((a) => !a.startsWith('--') && argv[argv.indexOf(a) - 1] !== '--registry' && argv[argv.indexOf(a) - 1] !== '--skills-dir');
  if (!name) die(2, 'usage: install-skill.cjs <name> [--yes] [--force]');
  const regFile = flag('--registry') || path.join(__dirname, '..', 'registry.json');
  const reg = JSON.parse(fs.readFileSync(regFile, 'utf8'));
  const e = reg.skills && reg.skills[name];
  if (!e) die(2, `"${name}" is not in the registry`);
  if (!/^[0-9a-f]{40}$/.test(e.sha || '') || !/^[0-9a-f]{64}$/.test(e.skillSha256 || '')) die(1, `"${name}" is not pinned yet (no commit/hash in the registry)`);
  const gh = /^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?$/.exec(e.repo || '');
  const okFile = process.env.MB_ALLOW_FILE === '1' && /^file:\/\//.test(e.repo || '');
  if (!okFile && !(gh && (reg.allowedOwners || []).includes(gh[1]))) die(1, 'repo is not an allowed GitHub owner: ' + e.repo);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mb-install-'));
  const repo = path.join(tmp, 'r');
  try {
    git(['clone', '--quiet', '-c', 'core.autocrlf=false', e.repo, repo]);
    git(['checkout', '--quiet', e.sha], repo);
    if (git(['rev-parse', 'HEAD'], repo) !== e.sha) die(1, 'checked-out commit does not match the pinned sha');
    const skill = path.join(repo, 'SKILL.md');
    if (!fs.existsSync(skill)) die(1, 'no SKILL.md at the repo root');
    // Hash the committed blob, not the working file: line-ending conversion would change the file hash per OS.
    const blob = cp.execFileSync('git', ['show', `${e.sha}:SKILL.md`], { cwd: repo, maxBuffer: 1 << 24 });
    if (crypto.createHash('sha256').update(blob).digest('hex') !== e.skillSha256) die(1, 'SKILL.md hash does not match the registry: refusing');
    const fm = frontmatter(skill);
    if (fm.name !== name) die(1, `SKILL.md name "${fm.name}" does not match "${name}"`);
    const list = files(repo);
    const bytes = list.reduce((n, f) => n + fs.statSync(f).size, 0);
    if (bytes > MAX_BYTES) die(1, `too large: ${bytes} bytes`);
    const dest = path.join(flag('--skills-dir') || process.env.MB_SKILLS_DIR || path.join(os.homedir(), '.claude', 'skills'), name);
    console.log(`skill:       ${name}\nrepo:        ${e.repo}\npinned:      ${e.sha.slice(0, 12)} (${e.ref})\nsize:        ${(bytes / 1024).toFixed(1)} KB, ${list.length} files\ndescription: ${fm.description}\ndestination: ${dest}`);
    if (!argv.includes('--yes')) { console.log('DRY RUN: show this to the human; re-run with --yes only after a clear yes.'); return; }
    if (fs.existsSync(dest) && !argv.includes('--force')) die(3, 'already installed (use --force to replace)');
    if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
    fs.cpSync(repo, dest, { recursive: true, filter: (s) => path.basename(s) !== '.git' });
    console.log('installed.');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

main();
