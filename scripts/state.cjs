#!/usr/bin/env node
'use strict';
// state.cjs <master_dir>: prints a status snapshot of 15 lines or fewer from STATE.md and BOARD.md.
const fs = require('fs');
const path = require('path');

const dir = process.argv[2];
if (!dir) { console.error('usage: state.cjs <master_dir>'); process.exit(2); }
const read = (f) => { try { return fs.readFileSync(path.join(dir, f), 'utf8').split(/\r?\n/); } catch { return null; } };

const out = [];
const state = read('STATE.md');
if (state) out.push(...state.map((l) => l.trim()).filter(Boolean).slice(0, 7));
else out.push('STATE.md: missing');

const board = read('BOARD.md');
if (board) {
  const rows = board.filter((l) => l.startsWith('|') && !/^\|\s*-+/.test(l));
  const open = rows.slice(1).filter((l) => !/\b(done|merged)\b/i.test(l));
  out.push(`BOARD: ${rows.length - 1} rows, ${open.length} open`);
  out.push(...open.slice(0, 6).map((l) => l.replace(/\s+/g, ' ').slice(0, 140)));
} else out.push('BOARD.md: missing');

console.log(out.slice(0, 15).join('\n'));
