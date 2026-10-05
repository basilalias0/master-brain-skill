#!/usr/bin/env node
'use strict';
// run-quiet.cjs --log FILE [--max N] -- <command...>
// Runs the command, saves ALL output to FILE, prints only the verdict, the first N error lines and the log path.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const argv = process.argv.slice(2);
const split = argv.indexOf('--');
const opts = split < 0 ? argv : argv.slice(0, split);
const cmd = split < 0 ? [] : argv.slice(split + 1);
const flag = (n, d) => { const i = opts.indexOf(n); return i >= 0 ? opts[i + 1] : d; };
const log = flag('--log');
const max = Number(flag('--max', 15));
if (!log || !cmd.length) { console.error('usage: run-quiet.cjs --log FILE [--max N] -- <command...>'); process.exit(2); }

// Windows needs a shell for npm/npx-style .cmd shims; everything else runs without one (no quoting issues).
const needShell = process.platform === 'win32' && /^(?:npm|npx|pnpm|yarn|tsc|vitest|playwright)$/i.test(cmd[0]);
const r = needShell
  ? spawnSync(cmd.map((a) => (/[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a)).join(' '), { shell: true, encoding: 'utf8', maxBuffer: 1 << 28 })
  : spawnSync(cmd[0], cmd.slice(1), { encoding: 'utf8', maxBuffer: 1 << 28 });
const out = (r.stdout || '') + (r.stderr || '');
fs.mkdirSync(path.dirname(path.resolve(log)), { recursive: true });
fs.writeFileSync(log, out);
const all = out.split(/\r?\n/);
const bad = all.filter((l) => /\b(error|fail(?:ed|ure|ing)?|exception|panic)\b|✖|✘/i.test(l)).slice(0, max);
console.log(`exit=${r.status} lines=${all.length} log=${log}`);
if (bad.length) console.log(bad.join('\n'));
process.exit(r.status === null ? 1 : r.status);
