#!/usr/bin/env node
'use strict';
// stop-gate.cjs: a Claude Code Stop hook that will not let a worker say "done" while its check fails (owner, 2026-11-18).
//   In the project's .claude/settings.json (a settings edit: the human approves it, SAFETY 12):
//   "hooks": { "Stop": [ { "hooks": [ { "type": "command",
//     "command": "node <skill_dir>/scripts/stop-gate.cjs --cmd \"<quick test or type check>\"" } ] } ] }
// Options: --cmd (required), --max N blocks in a row per session (default 2), --timeout SEC (default 300),
//          --all (also gate the main checkout; by default only git worktrees, where workers run, are gated).
// Exit 2 with the first error lines on stderr = Claude keeps working. It FAILS OPEN: bad input, a missing command,
// a timeout, an error in this script or the block limit all exit 0, because a Stop hook that always blocks traps
// the chat (Claude Code docs: hooks reference). Zero model tokens unless it blocks.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { stripVTControlCharacters } = require('util');

function args(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--all') o.all = true;
    else if (argv[i].startsWith('--')) o[argv[i].slice(2)] = argv[++i];
  }
  return o;
}

// A linked worktree has its own git dir inside the main repo's common dir; the main checkout's two are the same.
function inWorktree(cwd) {
  const g = (a) => spawnSync('git', ['rev-parse', a], { cwd, encoding: 'utf8' });
  const d = g('--absolute-git-dir'); const c = g('--git-common-dir');
  if (d.status !== 0 || c.status !== 0) return false;
  return path.resolve(cwd, d.stdout.trim()) !== path.resolve(cwd, c.stdout.trim());
}

function gate(input, o, cwd) {
  if (!o.cmd) return { code: 0, note: 'no --cmd: gate off' };
  if (!o.all && !inWorktree(cwd)) return { code: 0, note: 'main checkout: not gated' };
  const max = Number(o.max || 2);
  const key = String(input.session_id || 'none').replace(/[^\w-]/g, '_');
  const counter = path.join(os.tmpdir(), `mb-stop-gate-${key}.json`);
  let n = 0;
  try { n = JSON.parse(fs.readFileSync(counter, 'utf8')).n || 0; } catch {}
  if (!input.stop_hook_active) n = 0; // a fresh stop, not a retry after our own block
  if (n >= max) { fs.rmSync(counter, { force: true }); return { code: 0, note: `blocked ${n} times: letting it stop; report the failure` }; }
  const r = spawnSync(o.cmd, { cwd, shell: true, encoding: 'utf8', timeout: Number(o.timeout || 300) * 1000, maxBuffer: 1 << 26 });
  if (r.error || r.status === null) return { code: 0, note: `check could not run (${r.error ? r.error.code || r.error.message : 'timeout'}): not gating` };
  const out = stripVTControlCharacters((r.stdout || '') + (r.stderr || ''));
  if (r.status === 0) { fs.rmSync(counter, { force: true }); return { code: 0 }; }
  if (/is not recognized|command not found|Cannot find module/i.test(out) && r.status !== 0 && out.length < 2000) {
    return { code: 0, note: 'check command not found: not gating' };
  }
  fs.writeFileSync(counter, JSON.stringify({ n: n + 1 }));
  const lines = out.split(/\r?\n/).filter((l) => /\b(error|fail(?:ed|ure|ing)?|exception)\b|✖|✘/i.test(l)).slice(0, 15);
  return {
    code: 2,
    msg: `Check failed (exit ${r.status}): ${o.cmd}\n${lines.join('\n') || out.trim().split(/\r?\n/).slice(-15).join('\n')}\n` +
      `Fix it before reporting done, or report it as unresolved in the RESULT (block ${n + 1} of ${max}).`,
  };
}

if (require.main === module) {
  let code = 0;
  try {
    const raw = fs.readFileSync(0, 'utf8');
    let input = {};
    try { input = raw.trim() ? JSON.parse(raw) : {}; } catch {}
    const r = gate(input, args(process.argv.slice(2)), input.cwd || process.cwd());
    if (r.code === 2) process.stderr.write(r.msg);
    code = r.code;
  } catch { code = 0; }
  process.exit(code);
}

module.exports = { gate, inWorktree };
