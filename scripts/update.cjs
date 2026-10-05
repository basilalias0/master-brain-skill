#!/usr/bin/env node
'use strict';
// update.cjs [--skill DIR] [--dir MASTER_DIR] [--yes]
// Updates the installed skill with `git pull --ff-only` only. Never pushes, never merges, never resets.
// Without --yes it prints the plan and stops. Refuses when the skill folder has local edits.
const { spawnSync } = require('child_process');
const path = require('path');
const overlay = require('./overlay.cjs');

const git = (cwd, args) => spawnSync('git', args, { cwd, encoding: 'utf8' });

function plan(skill) {
  if (git(skill, ['rev-parse', '--is-inside-work-tree']).status !== 0) return { error: 'not a git checkout; reinstall from the repository' };
  const dirty = git(skill, ['status', '--porcelain']).stdout.trim();
  if (dirty) return { error: 'the skill folder has local edits; project-only changes belong in the overlay. Move or discard them yourself, then retry:\n' + dirty };
  const f = git(skill, ['fetch', '--quiet']);
  if (f.status !== 0) return { error: 'fetch failed: ' + (f.stderr || '').trim() };
  const behind = git(skill, ['rev-list', '--count', 'HEAD..@{u}']);
  if (behind.status !== 0) return { error: 'no upstream branch set' };
  const n = Number(behind.stdout.trim());
  const log = n ? git(skill, ['log', '--oneline', 'HEAD..@{u}']).stdout.trim() : '';
  return { behind: n, log };
}

function run(skill, dir, yes) {
  const p = plan(skill);
  if (p.error) return { code: 1, text: 'update: ' + p.error };
  if (!p.behind) return { code: 0, text: 'update: already up to date' };
  if (!yes) return { code: 0, text: `update: ${p.behind} new commit(s):\n${p.log}\nRun again with --yes after you approve.` };
  const pull = git(skill, ['pull', '--ff-only', '--quiet']);
  if (pull.status !== 0) return { code: 1, text: 'update: fast-forward not possible, nothing changed: ' + (pull.stderr || '').trim() };
  const lines = overlay.check(dir, skill);
  overlay.rebase(dir, skill);
  return { code: 0, text: `update: pulled ${p.behind} commit(s)\n` + lines.join('\n') };
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const flag = (n) => { const i = argv.indexOf(n); return i > -1 ? argv[i + 1] : undefined; };
  const r = run(path.resolve(flag('--skill') || path.join(__dirname, '..')), path.resolve(flag('--dir') || 'master-brain'), argv.includes('--yes'));
  console.log(r.text);
  process.exit(r.code);
}

module.exports = { run, plan };
