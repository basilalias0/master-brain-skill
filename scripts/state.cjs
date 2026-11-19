#!/usr/bin/env node
'use strict';
// state.cjs <master_dir>: prints a status snapshot of 15 lines or fewer from STATE.md and BOARD.md,
// plus a nudge when 10 or more tasks, or 8 or more decision-log entries (by highest DL number, so archiving does not
// reset it), were logged since the last improve run. boot.cjs reuses snapshot().
const fs = require('fs');
const path = require('path');

// Highest DL number in an ACTION_LOG (0 when none).
const maxDl = (s) => Math.max(0, ...[...s.matchAll(/^## DL-(\d+)/gm)].map((m) => Number(m[1])));

function snapshot(dir, max = 15) {
  const read = (f) => { try { return fs.readFileSync(path.join(dir, f), 'utf8').split(/\r?\n/); } catch { return null; } };
  const out = [];
  const state = read('STATE.md');
  if (state) out.push(...state.map((l) => l.trim()).filter(Boolean).slice(0, Math.min(7, max - 3)));
  else out.push('STATE.md: missing');

  const board = read('BOARD.md');
  if (board) {
    // A header is the row just above a separator; every table in the BOARD has one, not only the first.
    const sep = (l) => /^\|\s*:?-+/.test(l || '');
    const rows = board.filter((l, i) => l.startsWith('|') && !sep(l) && !sep(board[i + 1]));
    const open = rows.filter((l) => !/\b(done|merged)\b/i.test(l));
    out.push(`BOARD: ${rows.length} rows, ${open.length} open`);
    out.push(...open.slice(0, 6).map((l) => l.replace(/\s+/g, ' ').slice(0, 140)));
  } else out.push('BOARD.md: missing');

  const count = (f, fn) => { try { return fn(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { return 0; } };
  const logN = count('routing-log.jsonl', (s) => s.split('\n').filter(Boolean).length);
  const last = count(path.join('improve', 'last-run.json'), (s) => JSON.parse(s)) || {};
  const lastN = last.entries || 0;
  const dlN = count('ACTION_LOG.md', maxDl) - (last.dl || 0);
  const res = out.slice(0, max - 1);
  const why = [logN - lastN >= 10 && `${logN - lastN} tasks`, dlN >= 8 && `${dlN} decision-log entries`].filter(Boolean);
  if (why.length) res.push(`Nudge: ${why.join(' and ')} logged since the last review. Run /master-brain improve.`);
  else if (out[max - 1]) res.push(out[max - 1]);
  return res;
}

if (require.main === module) {
  const dir = process.argv[2];
  if (!dir) { console.error('usage: state.cjs <master_dir>'); process.exit(2); }
  console.log(snapshot(dir).join('\n'));
}

module.exports = { snapshot, maxDl };
