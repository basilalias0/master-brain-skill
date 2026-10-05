#!/usr/bin/env node
'use strict';
// pin.cjs <name> <repoPath> [--registry FILE] [--repo URL] [--ref TAG]
// Writes the repo's current commit and SKILL.md hash into the registry. Needs a clean work tree.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cp = require('child_process');

const git = (args, cwd) => cp.execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const argv = process.argv.slice(2);
const flag = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const [name, repoPath] = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')));
if (!name || !repoPath) { console.error('usage: pin.cjs <name> <repoPath> [--registry FILE] [--repo URL] [--ref TAG]'); process.exit(2); }

const regFile = flag('--registry') || path.join(__dirname, '..', 'registry.json');
const reg = JSON.parse(fs.readFileSync(regFile, 'utf8'));
if (!reg.skills[name] && !flag('--repo')) { console.error('not in the registry; pass --repo URL'); process.exit(2); }
if (git(['status', '--porcelain'], repoPath)) { console.error('refusing: work tree is not clean (commit first)'); process.exit(1); }

const sha = git(['rev-parse', 'HEAD'], repoPath);
// Hash the committed blob (same bytes on every OS), not the working file.
const skillSha256 = crypto.createHash('sha256').update(cp.execFileSync('git', ['show', `${sha}:SKILL.md`], { cwd: repoPath, maxBuffer: 1 << 24 })).digest('hex');
reg.skills[name] = { ...(reg.skills[name] || {}), repo: flag('--repo') || reg.skills[name].repo, ref: flag('--ref') || 'main', sha, skillSha256 };
fs.writeFileSync(regFile, JSON.stringify(reg, null, 2) + '\n');
console.log(`pinned ${name} @ ${sha.slice(0, 12)}`);
