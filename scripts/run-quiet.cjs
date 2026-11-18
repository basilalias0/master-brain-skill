#!/usr/bin/env node
'use strict';
// run-quiet.cjs --log FILE [--max N] -- <command...>
// Runs the command, saves ALL output to FILE, prints only the verdict, the first N error lines and the log path.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { stripVTControlCharacters } = require('util');

const argv = process.argv.slice(2);
const split = argv.indexOf('--');
const opts = split < 0 ? argv : argv.slice(0, split);
const cmd = split < 0 ? [] : argv.slice(split + 1);
const flag = (n, d) => { const i = opts.indexOf(n); return i >= 0 ? opts[i + 1] : d; };
const log = flag('--log');
const max = Number(flag('--max', 15));
if (!log || !cmd.length) { console.error('usage: run-quiet.cjs --log FILE [--max N] -- <command...>'); process.exit(2); }

fs.mkdirSync(path.dirname(path.resolve(log)), { recursive: true });
// Output goes straight to the file: no buffer limit, and stdout and stderr stay in the order they were written.
const run = (shell) => {
  const fd = fs.openSync(log, 'w');
  try {
    return shell
      ? spawnSync(cmd.map((a) => (/[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a)).join(' '), { shell: true, stdio: ['ignore', fd, fd] })
      : spawnSync(cmd[0], cmd.slice(1), { stdio: ['ignore', fd, fd] });
  } finally { fs.closeSync(fd); }
};
// Windows: .cmd/.bat shims (npm, npx, eslint, jest ...) need a shell since Node's CVE-2024-27980 fix (EINVAL without
// one), and names without an extension are not found (ENOENT). Known shims go to the shell first; others retry once.
const win = process.platform === 'win32';
let r = run(win && /^(?:npm|npx|pnpm|yarn|tsc|vitest|playwright)$/i.test(cmd[0]));
if (win && r.error && /^(?:EINVAL|ENOENT)$/.test(r.error.code)) r = run(true);
const out = fs.readFileSync(log, 'utf8');
const all = out.split(/\r?\n/);
const bad = all.map(stripVTControlCharacters).filter((l) => /\b(error|fail(?:ed|ure|ing)?|exception|panic)\b|✖|✘/i.test(l)).slice(0, max);
console.log(`exit=${r.status} lines=${all.length} log=${log}`);
if (r.error) console.log(`could not start: ${r.error.code || r.error.message}`);
else if (r.status !== 0 && /is not recognized|command not found/i.test(out)) console.log(`could not start: ${all.find((l) => /is not recognized|command not found/i.test(l)).trim()}`);
if (bad.length) console.log(bad.join('\n'));
process.exit(r.status === null ? 1 : r.status);
