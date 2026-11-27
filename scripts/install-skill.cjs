#!/usr/bin/env node
'use strict';
// install-skill.cjs <name> [--yes] [--force] [--clean] [--if-needed] [--registry FILE] [--skills-dir DIR] [--local-dir DIR]
// install-skill.cjs --check <name>: sha256 of every file in the entry's `fileSha256` map against the installed copy.
// install-skill.cjs --latest <name> [--write-pin]: scan the tip of the entry's `ref`; print (or write) the new pin.
// install-skill.cjs --offer <name>: the message to show the human (not part of master-brain, features, the scan,
//   the local clean copy) ending in the yes/no question. --list: one status line for every registry skill.
// install-skill.cjs --decline <name> --master-dir DIR: the human said no; boot stops listing it for this project.
// Installs a registry skill at its pinned commit after a full scan (skill-scan.cjs). Without --yes it only prints
// the plan (dry run). A high scan finding stops the install (exit 4). With --clean (the offer's yes covers it) a
// copy without the findings goes to <master-brain>/local/<name> (git-ignored: this machine only, never pushed).
// --if-needed: exit 0 with `path:` when a copy is already there (pin ok, or changed but rescanned clean);
//   otherwise print the offer and exit 5 (ask the human, then --yes --clean).
// Env: MB_SKILLS_DIR (destination), MB_ALLOW_FILE=1 (tests only: allow file:// repos).
// Exit: 0 ok or dry run, 1 refused (hash/pin/policy), 2 usage or unknown skill, 3 already installed, 4 threats found,
// 5 not installed (the offer was printed).
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const cp = require('child_process');
const scanner = require('./skill-scan.cjs');

const MAX_BYTES = 2 * 1024 * 1024;
const die = (code, msg) => { console.error('install-skill: ' + msg); process.exit(code); };
const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');
const git = (args, cwd) => cp.execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const blob = (cwd, spec) => cp.execFileSync('git', ['show', spec], { cwd, maxBuffer: 1 << 26 });

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

function mismatches(e, dir) {
  const bad = [];
  for (const [rel, hex] of Object.entries(e.fileSha256 || {})) {
    const f = path.join(dir, ...rel.split('/'));
    if (!fs.existsSync(f)) bad.push(`${rel}: missing`);
    else {
      // A copy made on Windows may carry CRLF line endings; the same text with LF endings still matches the pin.
      const b = fs.readFileSync(f);
      if (sha256(b) !== hex && sha256(Buffer.from(b.toString('latin1').replace(/\r\n/g, '\n'), 'latin1')) !== hex) bad.push(`${rel}: hash differs`);
    }
  }
  return bad;
}

function check(name, e, skillsDir) {
  if (!Object.keys(e.fileSha256 || {}).length) die(1, `"${name}" has no fileSha256 in the registry`);
  const bad = mismatches(e, path.join(skillsDir, name));
  if (bad.length) die(1, `check FAILED for ${name}\n` + bad.join('\n'));
  console.log(`check ok: ${name}, ${Object.keys(e.fileSha256).length} files match the pin`);
}

// Already there? Pin ok, or changed and rescanned clean: use it. Changed with threats: exit 4.
function existing(name, e, dest, localDest) {
  for (const dir of [dest, localDest]) {
    if (!fs.existsSync(path.join(dir, 'SKILL.md'))) continue;
    const local = dir === localDest;
    const bad = local ? [] : mismatches(e, dir);
    if (!bad.length) { console.log(`${name}: installed${local ? ' (cleaned local copy)' : ', pin ok'}\npath: ${dir}`); return true; }
    const r = scanner.scan(dir);
    console.log(`${name}: installed copy differs from the pin (${bad.length} files); rescanned\n` + scanner.report(r));
    if (scanner.high(r).length) die(4, 'threats in the changed copy: tell the human before using it');
    console.log('path: ' + dir);
    return true;
  }
  return false;
}

function pinOf(repo, sha, sub) {
  const prefix = sub ? sub + '/' : '';
  const list = git(['ls-tree', '-r', '--name-only', sha, '--', sub || '.'], repo).split('\n').filter(Boolean);
  const fileSha256 = {};
  let bytes = 0;
  for (const f of list) { const b = blob(repo, `${sha}:${f}`); bytes += b.length; fileSha256[f.slice(prefix.length)] = sha256(b); }
  return { sha, skillSha256: fileSha256['SKILL.md'], sizeKB: Math.round(bytes / 1024), fileSha256 };
}

const defaults = () => ({
  registry: path.join(__dirname, '..', 'registry.json'),
  skillsDir: process.env.MB_SKILLS_DIR || path.join(os.homedir(), '.claude', 'skills'),
  localDir: path.join(__dirname, '..', 'local'),
});

function installedAt(name, { skillsDir, localDir } = defaults()) {
  for (const d of [path.join(skillsDir, name), path.join(localDir, name)]) if (fs.existsSync(path.join(d, 'SKILL.md'))) return d;
  return null;
}

const declined = (masterDir) => {
  try { return new Set(fs.readFileSync(path.join(masterDir, 'skills-declined.txt'), 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean)); } catch { return new Set(); }
};

// The words the Master shows the human before any download. The human cannot know these skills exist otherwise.
function offerText(name, e, opts = defaults()) {
  const at = installedAt(name, opts);
  const size = e.sizeKB ? `${e.sizeKB >= 1024 ? (e.sizeKB / 1024).toFixed(1) + ' MB' : e.sizeKB + ' KB'}, ${Object.keys(e.fileSha256 || {}).length} files` : 'size unknown';
  return [
    `Optional skill: ${name}, by ${e.author || 'its author'} (${e.license || 'licence not stated'}).`,
    `It does not come with master-brain: it is a separate download (${size}) from ${e.repo}, pinned at ${String(e.sha || '').slice(0, 7)}.`,
    `Useful for: ${e.when || 'see its README'}.`,
    'What it does:',
    ...(e.features || []).map((f) => '- ' + f),
    'Before it is used, every file is scanned for threats (secret or data reading, data sent out, hidden instructions,',
    'hidden or encoded code, auto-run hooks). If anything is found, it is removed and the cleaned copy stays inside',
    'master-brain on this machine only: nothing is uploaded and the original repo is not changed. You see the scan result.',
    at ? `Status: already installed at ${at}.` : 'Shall I download it? (yes / no)',
  ].join('\n');
}

// One line for boot: which optional skills exist, which are installed, which the human declined.
function listLine(masterDir, opts = defaults()) {
  let reg;
  try { reg = JSON.parse(fs.readFileSync(opts.registry, 'utf8')); } catch { return null; }
  const no = masterDir ? declined(masterDir) : new Set();
  const items = Object.entries(reg.skills || {}).map(([n, e]) => `${n} (${e.short || e.when || ''}): ${no.has(n) ? 'declined' : installedAt(n, opts) ? 'installed' : 'not installed'}`);
  if (!items.length) return null;
  return 'extra skills, not part of master-brain (task matches one not installed: show `install-skill.cjs --offer <name>`, ask): ' + items.join('; ');
}

function main() {
  const argv = process.argv.slice(2);
  const VALUED = ['--registry', '--skills-dir', '--local-dir', '--master-dir'];
  if (argv.includes('--list')) {
    const get = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
    const o = defaults();
    if (get('--registry')) o.registry = get('--registry');
    if (get('--skills-dir')) o.skillsDir = get('--skills-dir');
    console.log(listLine(get('--master-dir'), o) || 'no registry skills');
    return;
  }
  const flag = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
  const has = (n) => argv.includes(n);
  const name = argv.find((a, i) => !a.startsWith('--') && !VALUED.includes(argv[i - 1]));
  if (!name) die(2, 'usage: install-skill.cjs <name> [--yes] [--force] [--clean] [--if-needed] | --check <name> | --latest <name> [--write-pin]');
  const regFile = flag('--registry') || path.join(__dirname, '..', 'registry.json');
  const reg = JSON.parse(fs.readFileSync(regFile, 'utf8'));
  const e = reg.skills && reg.skills[name];
  if (!e) die(2, `"${name}" is not in the registry`);
  const skillsDir = flag('--skills-dir') || process.env.MB_SKILLS_DIR || path.join(os.homedir(), '.claude', 'skills');
  const dest = path.join(skillsDir, name);
  const localDest = path.join(flag('--local-dir') || path.join(__dirname, '..', 'local'), name);
  const opts = { registry: regFile, skillsDir, localDir: path.dirname(localDest) };
  if (has('--check')) return check(name, e, skillsDir);
  if (has('--offer')) { console.log(offerText(name, e, opts)); return; }
  if (has('--decline')) {
    const md = flag('--master-dir');
    if (!md || !fs.existsSync(md)) die(2, '--decline needs --master-dir DIR');
    if (!declined(md).has(name)) fs.appendFileSync(path.join(md, 'skills-declined.txt'), name + '\n');
    console.log(`${name}: declined for this project; not offered again`);
    return;
  }
  if (has('--if-needed') && existing(name, e, dest, localDest)) return;
  if (has('--if-needed') && !has('--yes')) { console.log(offerText(name, e, opts)); process.exit(5); }
  const latest = has('--latest');
  if (!latest && (!/^[0-9a-f]{40}$/.test(e.sha || '') || !/^[0-9a-f]{64}$/.test(e.skillSha256 || ''))) die(1, `"${name}" is not pinned yet (no commit/hash in the registry)`);
  const gh = /^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?$/.exec(e.repo || '');
  const okFile = process.env.MB_ALLOW_FILE === '1' && /^file:\/\//.test(e.repo || '');
  if (!okFile && !(gh && (reg.allowedOwners || []).includes(gh[1]))) die(1, 'repo is not an allowed GitHub owner: ' + e.repo);
  const sub = e.path || '';
  if (sub && (!/^[\w.-]+(?:\/[\w.-]+)*$/.test(sub) || sub.split('/').includes('..'))) die(1, 'bad path in the registry: ' + sub);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mb-install-'));
  const repo = path.join(tmp, 'r');
  try {
    git(['clone', '--quiet', '-c', 'core.autocrlf=false', e.repo, repo]);
    const sha = latest ? git(['rev-parse', 'HEAD'], repo) : e.sha;
    git(['checkout', '--quiet', sha], repo);
    if (git(['rev-parse', 'HEAD'], repo) !== sha) die(1, 'checked-out commit does not match the pinned sha');
    const root = sub ? path.join(repo, ...sub.split('/')) : repo;
    const skill = path.join(root, 'SKILL.md');
    if (!fs.existsSync(skill)) die(1, 'no SKILL.md at ' + (sub || 'the repo root'));
    const list = files(root);
    const bytes = list.reduce((n, f) => n + fs.statSync(f).size, 0);
    if (bytes > MAX_BYTES) die(1, `too large: ${bytes} bytes`);
    const r = scanner.scan(root);
    const threats = scanner.high(r).length;

    if (latest) {
      const pin = pinOf(repo, sha, sub);
      console.log(`${name}: tip of ${e.ref} is ${sha.slice(0, 12)} (pinned ${String(e.sha || 'none').slice(0, 12)})\n` + scanner.report(r));
      if (threats) die(4, 'threats at the new commit: do not move the pin; tell the human');
      if (!has('--write-pin')) { console.log('new pin (re-run with --write-pin to save it):\n' + JSON.stringify(pin, null, 1)); return; }
      Object.assign(e, pin);
      fs.writeFileSync(regFile, JSON.stringify(reg, null, 2) + '\n');
      console.log('pin written to ' + regFile);
      return;
    }

    // Hash the committed blobs, not the working files: line-ending conversion would change the hash per OS.
    if (sha256(blob(repo, `${sha}:${sub ? sub + '/' : ''}SKILL.md`)) !== e.skillSha256) die(1, 'SKILL.md hash does not match the registry: refusing');
    if (e.fileSha256) {
      const pin = pinOf(repo, sha, sub).fileSha256;
      const bad = [...new Set([...Object.keys(pin), ...Object.keys(e.fileSha256)])].filter((f) => pin[f] !== e.fileSha256[f]);
      if (bad.length) die(1, 'files differ from the pin: ' + bad.join(', '));
    }
    const fm = frontmatter(skill);
    if (fm.name !== name) die(1, `SKILL.md name "${fm.name}" does not match "${name}"`);
    const clean = threats > 0 && has('--clean');
    const target = clean ? localDest : dest;
    console.log(`skill:       ${name}\nrepo:        ${e.repo}\npinned:      ${sha.slice(0, 12)} (${e.ref})\nsize:        ${(bytes / 1024).toFixed(1)} KB, ${list.length} files\ndescription: ${fm.description}\ndestination: ${target}${clean ? ' (local only)' : ''}\n` + scanner.report(r));
    if (threats && !clean) die(4, `${threats} high finding(s): not installed. Tell the human; with their yes, --clean installs a local copy without them`);
    if (!has('--yes')) { console.log('DRY RUN: show this to the human; re-run with --yes only after a clear yes.'); return; }
    if (fs.existsSync(target) && !has('--force') && !clean) die(3, 'already installed (use --force to replace)');
    if (clean) {
      const c = scanner.clean(root, target);
      console.log('cleaned copy, removed: ' + (c.removed.join(', ') || 'nothing') + '\n' + scanner.report(c.rescan));
      if (scanner.high(c.rescan).length) { fs.rmSync(target, { recursive: true, force: true }); die(4, 'the cleaned copy still has high findings: not installed'); }
      console.log('installed (local copy, never pushed).\npath: ' + target);
      return;
    }
    if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
    fs.cpSync(root, target, { recursive: true, filter: (s) => path.basename(s) !== '.git' });
    console.log('installed.\npath: ' + target);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

if (require.main === module) main();

module.exports = { offerText, listLine, installedAt };
