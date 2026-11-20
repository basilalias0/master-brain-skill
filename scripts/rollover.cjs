#!/usr/bin/env node
'use strict';
// rollover.cjs: hand a long Chief or Master chat over to a fresh one. Zero model tokens.
//   due <context_tokens> [--at 250000]   exit 0 and say "roll over" when the chat is at or past the point, else exit 1
//   handoff <master_dir> [--chat C1|M3] [--mark]  write masters/<chat>-next.md: open work only, at most 60 lines, and
//                                        print it. For a Master, only its own tasks (W-M3-*) go across, plus its area
//                                        row. --mark = clear in place: the first steps say the id is unchanged, and the
//                                        reboot marker is written too (reboot.cjs mark; this chat's id from the host).
//   choose <master_dir> --ctx N [--chat C1|M3] [--mode auto|default|...] [--fresh N]
//                                        which rollover costs fewer tokens now (law 12 `rollover: auto`): see cost().
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

function handoff(md, chat, { inPlace = false } = {}) {
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
  if (inPlace) lines.push('## First steps (same chat, cleared in place)',
    '1. Your session id is unchanged: tell no one a new id, update no BOARD id, archive nothing.',
    `2. ${master ? 'Then take the task that brought you here (the message from the Chief, or the bug report).' : 'Tell the human in one line that the Chief rolled over in place and what is open; then handle the waiting message.'}`);
  else lines.push('## First steps', master
    ? `1. Write this session id into the BOARD Masters row for ${chat}, and tell the Chief: "${chat} is now <this session id>".`
    : '1. Message each Master in the table: "Chief is now <this session id>; send RESULTs here."',
    `2. ${master ? 'Then take the task that brought you here (the message from the Chief, or the bug report).' : 'Tell the human in one line that the Chief rolled over and what is open.'}`,
    '3. Once every Master has answered with the new id, remove the old chat: `archive_session` on its id, or `delete_session`',
    '   when LAWS.md law 12 says `old chats: delete`. Never before the answers, never any other chat.');
  return lines.slice(0, 60).join('\n') + '\n';
}

// Masters listed in the BOARD's Masters table (rows of a table whose heading names masters).
function mastersOnBoard(md) {
  const board = read(path.join(md, 'BOARD.md'));
  return board ? tables(board).filter((t) => /master/i.test(t.heading)).reduce((n, t) => n + t.rows.length, 0) : 0;
}

// The reboot hook is in the project's .claude settings (reboot.cjs hook under SessionStart).
function hookInstalled(md) {
  const proj = path.dirname(path.resolve(md));
  return ['settings.json', 'settings.local.json'].some((f) => {
    const s = read(path.join(proj, '.claude', f));
    return !!s && /SessionStart/.test(s) && /reboot\.cjs(?:\\?")?\s+hook\b/.test(s); // path may be quoted: \"...reboot.cjs\" hook
  });
}

// Law 12's rollover setting: auto (default), new chat, or clear in place.
function setting(md) {
  const m = /Rollover:\s*`?(auto|new chat|clear in place)\b/i.exec(read(path.join(md, 'LAWS.md')) || '');
  return m ? m[1].toLowerCase() : 'auto';
}

// Token cost of each rollover, counted in steps: each step re-reads the whole chat (TOKENS), so a step in the old chat
// costs about its context (ctx) and one in the fresh chat about the fresh start (fresh, default 60k: system prompt,
// tools and skills about 56k in a 2026-11-19 session, plus boot, digest and handoff).
//   new chat:       old chat: handoff, start_session (2)    fresh chat: tell each peer the new id, read each answer, archive
//   clear in place: old chat: handoff --mark, clear_session (2; 3 in auto mode, where the first call is refused once)
// peers = the Masters on the BOARD for the Chief, 1 (the Chief) for a Master. A tie goes to clear in place.
function cost({ ctx, fresh = 60000, peers = 0, auto = true }) {
  return { newChat: 2 * ctx + (2 * peers + 1) * fresh, inPlace: (auto ? 3 : 2) * ctx };
}

function choose(md, { ctx, chat = 'C1', mode = 'auto', fresh = 60000 } = {}) {
  const peers = /^M/.test(chat) ? 1 : mastersOnBoard(md);
  const c = cost({ ctx: Number(ctx), fresh: Number(fresh), peers, auto: mode === 'auto' });
  const set = setting(md); const hook = hookInstalled(md);
  const M = (n) => `${(n / 1e6).toFixed(2)}M`;
  const est = `clear in place ≈${M(c.inPlace)}, new chat ≈${M(c.newChat)} (${peers} peer${peers === 1 ? '' : 's'}, ${mode} mode)`;
  let method; let why;
  if (set === 'new chat') { method = 'new chat'; why = 'law 12 says new chat'; }
  else if (!hook) { method = 'new chat'; why = 'the reboot hook is not installed'; }
  else if (set === 'clear in place') { method = 'clear in place'; why = 'law 12 says clear in place'; }
  else { method = c.inPlace <= c.newChat ? 'clear in place' : 'new chat'; why = c.inPlace <= c.newChat ? 'not more tokens' : 'fewer tokens'; }
  const next = method === 'clear in place'
    ? `rollover.cjs handoff <master_dir> --chat ${chat} --mark, then clear_session self`
    : `rollover.cjs handoff <master_dir> --chat ${chat}, then start_session`;
  return { method, ...c, peers, hook, setting: set, line: `method: ${method} (${why}; ${est}): ${next}` };
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
    const inPlace = rest.includes('--mark');
    const text = handoff(a, chat, { inPlace });
    fs.mkdirSync(path.join(a, 'masters'), { recursive: true });
    fs.writeFileSync(path.join(a, 'masters', `${chat}-next.md`), text);
    console.log(text);
    if (inPlace) {
      try { console.log('reboot: marked ' + require('./reboot.cjs').mark(a, { chat }) + '; now clear_session self'); }
      catch (e) { console.error('reboot: ' + e.message); process.exit(1); }
    }
    process.exit(0);
  }
  if (cmd === 'choose' && a) {
    const ctx = Number(flag('--ctx'));
    if (!(ctx >= 0)) { console.error('usage: rollover.cjs choose <master_dir> --ctx N [--chat C1|M3] [--mode auto|default] [--fresh N]'); process.exit(2); }
    console.log(choose(a, { ctx, chat: flag('--chat', 'C1'), mode: flag('--mode', 'auto'), fresh: flag('--fresh', 60000) }).line);
    process.exit(0);
  }
  console.error('usage: rollover.cjs due <context_tokens> [--at N] | handoff <master_dir> [--chat C1] [--mark] | choose <master_dir> --ctx N ...');
  process.exit(2);
}

module.exports = { handoff, tables, lastBlock, due, cost, choose, mastersOnBoard, hookInstalled, setting };
