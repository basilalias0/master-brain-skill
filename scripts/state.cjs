#!/usr/bin/env node
'use strict';
// state.cjs <master_dir>: prints a status snapshot of 15 lines or fewer from STATE.md and BOARD.md,
// plus a nudge when 10 or more tasks were logged since the last improve run. boot.cjs reuses snapshot().
const fs = require('fs');
const path = require('path');

function snapshot(dir, max = 15) {
  const read = (f) => { try { return fs.readFileSync(path.join(dir, f), 'utf8').split(/\r?\n/); } catch { return null; } };
  const out = [];
  const state = read('STATE.md');
  if (state) out.push(...state.map((l) => l.trim()).filter(Boolean).slice(0, Math.min(7, max - 3)));
  else out.push('STATE.md: missing');

  const board = read('BOARD.md');
  if (board) {
    const rows = board.filter((l) => l.startsWith('|') && !/^\|\s*-+/.test(l));
    const open = rows.slice(1).filter((l) => !/\b(done|merged)\b/i.test(l));
    out.push(`BOARD: ${rows.length - 1} rows, ${open.length} open`);
    out.push(...open.slice(0, 6).map((l) => l.replace(/\s+/g, ' ').slice(0, 140)));
  } else out.push('BOARD.md: missing');

  const count = (f, fn) => { try { return fn(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { return 0; } };
  const logN = count('routing-log.jsonl', (s) => s.split('\n').filter(Boolean).length);
  const lastN = count(path.join('improve', 'last-run.json'), (s) => JSON.parse(s).entries || 0);
  const res = out.slice(0, max - 1);
  if (logN - lastN >= 10) res.push(`Nudge: ${logN - lastN} tasks logged since the last review. Run /master-brain improve.`);
  else if (out[max - 1]) res.push(out[max - 1]);
  return res;
}

if (require.main === module) {
  const dir = process.argv[2];
  if (!dir) { console.error('usage: state.cjs <master_dir>'); process.exit(2); }
  console.log(snapshot(dir).join('\n'));
}

module.exports = { snapshot };
