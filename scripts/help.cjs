#!/usr/bin/env node
'use strict';
// help.cjs [name]: prints the one-page index, or the help for one module or subcommand. No model tokens.
// Module help lives in modules/<name>/HELP.md (next to the module, so reading the module for work costs nothing extra).
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ALIAS = { analyze: 'analyzer', test: 'tester', '-h': null, '--help': null, '-help': null, help: null };
const read = (f) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

function sections() {
  const out = {};
  let cur = null;
  for (const l of read(path.join(ROOT, 'core', 'HELP.md')).split('\n')) {
    const m = /^## (\S+)\s*$/.exec(l);
    if (m) { cur = m[1]; out[cur] = []; } else if (cur) out[cur].push(l);
  }
  for (const k of Object.keys(out)) out[k] = out[k].join('\n').trim();
  return out;
}

function modules() {
  const dir = path.join(ROOT, 'modules');
  if (!fs.existsSync(dir)) return {};
  const out = {};
  for (const n of fs.readdirSync(dir)) {
    const f = path.join(dir, n, 'HELP.md');
    if (fs.existsSync(f)) out[n] = read(f).replace(/^# .*\n+/, '').trim();
  }
  return out;
}

function help(name) {
  const S = sections(); const M = modules();
  const key = name === undefined || name === null || ALIAS[name] === null ? null : (ALIAS[name] || name);
  if (!key) {
    const lines = [S.index, '', 'Modules:'];
    for (const [n, t] of Object.entries(M)) lines.push(`  ${n.padEnd(10)} ${(/^Purpose: (.*)$/m.exec(t) || [, ''])[1]}`);
    lines.push('', 'Subcommands:');
    for (const [n, t] of Object.entries(M)) { const u = /^Use: (.*)$/m.exec(t); if (u) lines.push(`  ${u[1]}`); }
    return lines.join('\n');
  }
  if (M[key]) return `${key}\n${M[key]}`;
  if (S[key]) return `${key}\n${S[key]}`;
  return `No help for "${name}". Try: ${[...Object.keys(S).filter((k) => k !== 'index'), ...Object.keys(M)].join(', ')}`;
}

if (require.main === module) {
  const arg = process.argv[2];
  const text = help(arg);
  console.log(text);
  process.exit(text.startsWith('No help for') ? 1 : 0);
}

module.exports = { help };
