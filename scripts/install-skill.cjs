#!/usr/bin/env node
'use strict';
// install-skill.cjs <name> [--registry FILE] [--skills-dir DIR] [--yes] [--force]
// install-skill.cjs --check <name> [--registry FILE] [--skills-dir DIR]: sha256 of every file in the entry's
//   `fileSha256` map ({ "relative/path": "<hex>" }) against the installed copy. Exit 0 all match, 1 any differ or missing.
// A registry entry may name `path`: the skill's folder inside the repo; only that folder is hashed-checked and copied.
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
  const m = /^---\n([\s\S]*?)\n---/.exec(fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n'));
  const get = (k) => {
    const r = new RegExp('^' + k + ':[ \\t]*(.*)$((?:\\n[ \\t]+.*)*)', 'm').exec(m ? m[1] : '');
    if (!r) return '';
    // YAML block scalar (">", ">-", "|" ...): the value is the indented lines below, folded into one line of text.
    if (/^[>|][+-]?$/.test(r[1].trim())) return r[2].split('\n').map((l) => l.trim()).filter(Boolean).join(' ');
    return r[1].replace(/^"|"$/g, '');
  };
  return { name: get('name'), description: get('description') };
}

function check(name, e, skillsDir) {
  const want = e.fileSha256 || {};
  if (!Object.keys(want).length) die(1, `"${name}" has no fileSha256 in the registry`);
  const dir = path.join(skillsDir, name);
  const bad = [];
  for (const [rel, hex] of Object.entries(want)) {
    const f = path.join(dir, ...rel.split('/'));
    if (!fs.existsSync(f)) bad.push(`${rel}: missing`);
    else if (sha256(f) !== hex) bad.push(`${rel}: hash differs`);
  }
  if (bad.length) die(1, `check FAILED for ${name}\n` + bad.join('\n'));
  console.log(`check ok: ${name}, ${Object.keys(want).length} files match the pin`);
}

function main() {
  const argv = process.argv.slice(2);
  const flag = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
  const name = argv.find((a) => !a.startsWith('--') && argv[argv.indexOf(a) - 1] !== '--registry' && argv[argv.indexOf(a) - 1] !== '--skills-dir');
  if (!name) die(2, 'usage: install-skill.cjs <name> [--yes] [--force] | --check <name>');
  const regFile = flag('--registry') || path.join(__dirname, '..', 'registry.json');
  const reg = JSON.parse(fs.readFileSync(regFile, 'utf8'));
  const e = reg.skills && reg.skills[name];
  if (!e) die(2, `"${name}" is not in the registry`);
  if (argv.includes('--check')) return check(name, e, flag('--skills-dir') || process.env.MB_SKILLS_DIR || path.join(os.homedir(), '.claude', 'skills'));
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
    // Optional `path`: the skill folder inside the repo (forward slashes, no '..', no leading slash).
    const sub = e.path || '';
    if (sub && (!/^[\w.-]+(?:\/[\w.-]+)*$/.test(sub) || sub.split('/').includes('..'))) die(1, 'bad path in the registry: ' + sub);
    const root = sub ? path.join(repo, ...sub.split('/')) : repo;
    const skill = path.join(root, 'SKILL.md');
    if (!fs.existsSync(skill)) die(1, 'no SKILL.md at ' + (sub || 'the repo root'));
    // Hash the committed blob, not the working file: line-ending conversion would change the file hash per OS.
    const blob = cp.execFileSync('git', ['show', `${e.sha}:${sub ? sub + '/' : ''}SKILL.md`], { cwd: repo, maxBuffer: 1 << 24 });
    if (crypto.createHash('sha256').update(blob).digest('hex') !== e.skillSha256) die(1, 'SKILL.md hash does not match the registry: refusing');
    const fm = frontmatter(skill);
    if (fm.name !== name) die(1, `SKILL.md name "${fm.name}" does not match "${name}"`);
    const list = files(root);
    const bytes = list.reduce((n, f) => n + fs.statSync(f).size, 0);
    if (bytes > MAX_BYTES) die(1, `too large: ${bytes} bytes`);
    const dest = path.join(flag('--skills-dir') || process.env.MB_SKILLS_DIR || path.join(os.homedir(), '.claude', 'skills'), name);
    console.log(`skill:       ${name}\nrepo:        ${e.repo}\npinned:      ${e.sha.slice(0, 12)} (${e.ref})\nsize:        ${(bytes / 1024).toFixed(1)} KB, ${list.length} files\ndescription: ${fm.description}\ndestination: ${dest}`);
    if (!argv.includes('--yes')) { console.log('DRY RUN: show this to the human; re-run with --yes only after a clear yes.'); return; }
    if (fs.existsSync(dest) && !argv.includes('--force')) die(3, 'already installed (use --force to replace)');
    if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
    fs.cpSync(root, dest, { recursive: true, filter: (s) => path.basename(s) !== '.git' });
    console.log('installed.');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

main();
