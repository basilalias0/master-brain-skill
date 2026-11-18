#!/usr/bin/env node
'use strict';
// rollover.cjs: hand a long Chief or Master chat over to a fresh one. Zero model tokens.
//   due <context_tokens> [--at 250000]   exit 0 and say "roll over" when the chat is at or past the point, else exit 1
//   handoff <master_dir> [--chat C1|M3]  write masters/<chat>-next.md: open work only, at most 60 lines, and print it.
//                                        For a Master, only its own tasks (W-M3-*) go across, plus its area row.
// Why: every step re-reads the whole chat, so a long Chief pays its full length on each step (cache reads were 97.7% of
// one session's tokens). A fresh Chief built from files starts small, and the rules come from LAWS_DIGEST.md word for
// word instead of a model's summary. Finished work is NOT copied: it stays in ACTION_LOG, handoffs/ and the BOARD's
// done rows, where any chat can grep it.
const fs = require('fs');
const path = require('path');

const DONE = /\b(done|merged|closed|cancell?ed|superseded)\b/i;
const read = (f) => { try { return fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n'); } catch { return null; } };

// Each markdown table under a heading, as { heading, header, rows }.
function tables(md) {
  const out = []; let heading = ''; let cur = null;
  for (const l of md.split('\n')) {
    if (/^#+\s/.test(l)) { heading = l.replace(/^#+\s*/, ''); cur = null; continue; }
    if (/^\|/.test(l.trim())) {
      if (/^\|\s*:?-/.test(l.trim())) continue;
      if (!cur) { cur = { heading, header: l.trim(), rows: [] }; out.push(cur); } else cur.rows.push(l.trim());
    } else cur = null;
  }
  return out;
}

// The LAST block of a history file. Default: open lines only (done ones stay in the file), 12 at most.
function lastBlock(md, { keepDone = false, max = 12 } = {}) {
  if (!md) return [];
  const ls = md.split('\n'); const i = ls.findIndex((l) => /^## LAST/.test(l));
  if (i < 0) return [];
  const end = ls.findIndex((l, k) => k > i && /^## /.test(l));
  return ls.slice(i + 1, end < 0 ? ls.length : end).filter((l) => l.trim() && (keepDone || !DONE.test(l))).slice(0, max);
}

function handoff(md, chat) {
  const master = /^M\d+$/.test(chat);
  const mine = (r) => !master || new RegExp('\\b(W-)?' + chat + '\\b').test(r);
  const lines = [`# ${chat} handoff to a fresh chat (${new Date().toISOString().slice(0, 16)}Z)`, '',
    `Boot as usual (${master ? '`/master-brain resume`, as ' + chat + ', the same area owner' : '`/master-brain chief`'}), then read this file instead of the old chat.`,
    'Rules: `LAWS_DIGEST.md`, word for word. Finished work is not here: grep ACTION_LOG, handoffs/ and the BOARD.', ''];
  const board = read(path.join(md, 'BOARD.md'));
  if (board) {
    for (const t of tables(board)) {
      const keep = (/master/i.test(t.heading) ? t.rows : t.rows.filter((r) => !DONE.test(r))).filter(mine);
      if (!keep.length) continue;
      lines.push(`## ${t.heading || 'BOARD'}${/master/i.test(t.heading) ? '' : ` (open: ${keep.length} of ${t.rows.length})`}`, t.header, keep[0].replace(/[^|]/g, '-').replace(/-+/g, '---'), ...keep.slice(0, 20), '');
    }
  } else lines.push('BOARD.md: missing', '');
  const last = lastBlock(read(path.join(md, 'masters', chat + '.md')));
  if (last.length) lines.push(`## Open items from ${chat}'s LAST block`, ...last, '');
  const locks = path.join(md, 'locks');
  const held = fs.existsSync(locks) ? fs.readdirSync(locks).filter((d) => !d.endsWith('.steal')) : [];
  if (held.length) lines.push('## Locks held', ...held.map((h) => `- ${h} (scripts/lock.cjs status ${h})`), '');
  let servers = [];
  try { servers = require('./server.cjs').alive(md); } catch {}
  if (servers.length) lines.push('## Servers running', ...servers.map((s) => `- ${s.name}${s.port ? ' :' + s.port : ''} (pid ${s.pid})`), '');
  lines.push('## First steps', master
    ? `1. Write this session id into the BOARD Masters row for ${chat}, and tell the Chief: "${chat} is now <this session id>".`
    : '1. Message each Master in the table: "Chief is now <this session id>; send RESULTs here."',
    `2. ${master ? 'Then take the task that brought you here (the message from the Chief, or the bug report).' : 'Tell the human in one line that the Chief rolled over and what is open.'}`,
    '3. Once every Master has answered with the new id, remove the old chat: `archive_session` on its id, or `delete_session`',
    '   when LAWS.md law 12 says `old chats: delete`. Never before the answers, never any other chat.');
  return lines.slice(0, 60).join('\n') + '\n';
}

// Due at or past the rollover point (default 250k context tokens).
function due(tokens, at = 250000) { return Number(tokens) >= Number(at); }

if (require.main === module) {
  const [cmd, a, ...rest] = process.argv.slice(2);
  const flag = (n, d) => { const i = rest.indexOf(n); return i >= 0 ? rest[i + 1] : d; };
  if (cmd === 'due') {
    const at = Number(flag('--at', 250000)); const n = Number(a);
    if (!(n >= 0)) { console.error('usage: rollover.cjs due <context_tokens> [--at N]'); process.exit(2); }
    if (n >= at) { console.log(`roll over: context ${n} >= ${at}`); process.exit(0); }
    console.log(`keep: context ${n} < ${at}`); process.exit(1);
  }
  if (cmd === 'handoff' && a) {
    const chat = flag('--chat', 'C1');
    const text = handoff(a, chat);
    fs.mkdirSync(path.join(a, 'masters'), { recursive: true });
    fs.writeFileSync(path.join(a, 'masters', `${chat}-next.md`), text);
    console.log(text);
    process.exit(0);
  }
  console.error('usage: rollover.cjs due <context_tokens> [--at N] | handoff <master_dir> [--chat C1]');
  process.exit(2);
}

module.exports = { handoff, tables, lastBlock, due };
