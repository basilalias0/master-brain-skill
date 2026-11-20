#!/usr/bin/env node
'use strict';
// reboot.cjs: roll a Chief or Master over in the SAME chat (clear in place) instead of a new one. Zero model tokens.
//   mark <master_dir> [--chat C1|M3] [--session local_...]   before clear_session self: write masters/.reboot (needs
//                                         masters/<chat>-next.md from `rollover.cjs handoff`; --session is this chat's
//                                         id from get_session self, so only this chat can pick the marker up)
//   hook [--ttl MIN] [--log FILE]         a Claude Code SessionStart hook. Reads the hook JSON on stdin; when a fresh
//                                         marker is found above cwd it prints the boot order and the handoff as
//                                         additionalContext, then consumes the marker.
//   In the project's .claude/settings.json (a settings edit: the human approves it, SAFETY 12). The matcher is
//   "startup|clear": the desktop app's clear restarts the chat and reports "startup" (trial 2026-11-20).
//   "hooks": { "SessionStart": [ { "matcher": "startup|clear", "hooks": [ { "type": "command",
//     "command": "node <skill_dir>/scripts/reboot.cjs hook" } ] } ] }
// In auto mode the app adds a `session` label to clear_session after review, so the first call is refused with the
// input to send: send that exact input once more (trial 2026-11-20: the second call was accepted).
// Why: a clear keeps the session id, so Masters keep messaging the same Chief and no old chat is left to archive.
// A hook cannot start a turn (Claude Code docs: hooks reference); the next message, a Master's RESULT or the human's,
// finds the chat already told who it is. FAILS OPEN: no marker, a stale (over --ttl minutes, default 30) or foreign
// marker, bad input or any error prints nothing and exits 0, so every other clear is a normal clear.
const fs = require('fs');
const path = require('path');

const MAX_CONTEXT = 9500; // the docs cap additionalContext at 10,000 characters
const CHAT = /^(C1|M\d+)$/;

// The master_dir that a chat in `cwd` uses: master-brain/STATE.md in cwd or up to 6 levels above (SKILL boot step 1).
function findMaster(cwd) {
  let d = path.resolve(cwd);
  for (let i = 0; i <= 6; i++) {
    const m = path.join(d, 'master-brain');
    if (fs.existsSync(path.join(m, 'STATE.md'))) return m;
    const up = path.dirname(d);
    if (up === d) break;
    d = up;
  }
  return null;
}

// session defaults to this chat's own id, which the desktop app puts in CLAUDE_CODE_HOST_SESSION_ID for every
// process it starts (tools and hooks alike), so the Chief needs no get_session step.
function mark(master, { chat = 'C1', session = process.env.CLAUDE_CODE_HOST_SESSION_ID, now = Date.now() } = {}) {
  if (!CHAT.test(chat)) throw new Error('--chat must be C1 or M<n>: ' + chat);
  const handoff = path.join(master, 'masters', `${chat}-next.md`);
  if (!fs.existsSync(handoff)) throw new Error(`no handoff at ${handoff}; run rollover.cjs handoff first`);
  const marker = path.join(master, 'masters', '.reboot');
  fs.writeFileSync(marker, JSON.stringify({ chat, session: session || null, at: new Date(now).toISOString() }) + '\n');
  return marker;
}

function context(master, m) {
  const role = m.chat === 'C1' ? 'the Chief (C1)' : `Master ${m.chat}`;
  const boot = m.chat === 'C1' ? 'the master-brain skill with argument `chief`' : `the master-brain skill (resume) as ${m.chat} (boot.cjs --self ${m.chat})`;
  const handoff = fs.readFileSync(path.join(master, 'masters', `${m.chat}-next.md`), 'utf8');
  const head = [
    `This chat was just cleared on purpose as a rollover of ${role} for ${path.dirname(master)}. The old conversation is gone.`,
    `Before you answer anything else, including the message that arrives next: run ${boot}, read LAWS_DIGEST.md, then`,
    `continue from the handoff below (masters/${m.chat}-next.md). Your session id is unchanged, so Masters and workers`,
    'still reach you here; tell no one a new id and archive nothing. Then handle the waiting message.',
    '', `--- masters/${m.chat}-next.md ---`, ''].join('\n');
  const room = MAX_CONTEXT - head.length;
  return head + (handoff.length > room ? handoff.slice(0, room - 60) + `\n[handoff cut at ${room} chars; read the file]` : handoff);
}

// Returns the hook's stdout text ('' = say nothing).
// The desktop app's clear restarts the chat's process, so the hook sees source "startup" (a new internal
// session_id; the app's local_ id is unchanged and reaches the hook as CLAUDE_CODE_HOST_SESSION_ID): trial
// 2026-11-20, restart 8 s after the clear. A marker that names the app's session (`mark --session local_...`, from
// get_session self) fires only in that chat. One without it fires on a startup within startupMin of the marker only.
function hook(input, { now = Date.now(), ttlMin = 30, startupMin = 5, hostId = process.env.CLAUDE_CODE_HOST_SESSION_ID } = {}) {
  let e; try { e = JSON.parse(input || '{}'); } catch { return ''; }
  if (e.source && !['clear', 'startup'].includes(e.source)) return '';
  const master = findMaster(e.cwd || process.cwd());
  if (!master) return '';
  const marker = path.join(master, 'masters', '.reboot');
  if (!fs.existsSync(marker)) return '';
  let m; try { m = JSON.parse(fs.readFileSync(marker, 'utf8')); } catch { return ''; }
  if (!CHAT.test(m.chat || '')) return '';
  if (m.session && m.session !== hostId && m.session !== e.session_id) return ''; // another chat's rollover: leave it
  const age = now - Date.parse(m.at);
  if (!(age <= ttlMin * 60e3)) { fs.renameSync(marker, marker + '.stale'); return ''; }
  if (e.source === 'startup' && !m.session && !(age <= startupMin * 60e3)) return '';
  const text = context(master, m);
  fs.renameSync(marker, marker + '.used'); // consumed: a later clear is a normal clear
  return JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: text } });
}

if (require.main === module) {
  const [cmd, a, ...rest] = process.argv.slice(2);
  const flag = (n) => { const i = rest.indexOf(n); return i >= 0 ? rest[i + 1] : undefined; };
  if (cmd === 'mark') {
    try { console.log('reboot: marked ' + mark(a, { chat: flag('--chat'), session: flag('--session') }) + '; now clear_session self'); }
    catch (err) { console.error('reboot: ' + err.message); process.exit(1); }
  } else if (cmd === 'hook') {
    let input = '';
    process.stdin.on('data', (c) => { input += c; });
    process.stdin.on('end', () => {
      const all = [a, ...rest];
      const opt = (n) => { const i = all.indexOf(n); return i >= 0 ? all[i + 1] : undefined; };
      let out = '';
      try { out = hook(input, { ttlMin: Number(opt('--ttl')) || 30 }); if (out) process.stdout.write(out); } catch { /* fail open */ }
      // --log FILE: one line per start (source, the app's session id, fired). Never the environment: it holds the
      // account's email and ids.
      try {
        if (opt('--log')) {
          let src = null; try { src = JSON.parse(input).source || null; } catch { /* bad input */ }
          fs.appendFileSync(opt('--log'), JSON.stringify({ at: new Date().toISOString(), source: src, host: process.env.CLAUDE_CODE_HOST_SESSION_ID || null, fired: !!out }) + '\n');
        }
      } catch { /* fail open */ }
      process.exit(0);
    });
  } else { console.error('usage: reboot.cjs mark <master_dir> [--chat C1|M3] [--session ID] | hook [--ttl MIN] [--log FILE]'); process.exit(2); }
}

module.exports = { mark, hook, findMaster, context };
