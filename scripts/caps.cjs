#!/usr/bin/env node
'use strict';
// caps.cjs diff <CAPABILITIES.md> <tools.txt>   Zero model tokens.
// Compares the tools a host offers (tools.txt: one name per line, copied by the Master from its loaded and deferred
// tool lists into <master_dir>/caps/tools-YYYY-MM-DD.txt) with the backticked names in the Tool column of CAPABILITIES.md.
//   missing:  mapped in CAPABILITIES.md, not on the host
//   unmapped: on the host, in a known group, not mapped and not ignored
// Only the known groups below are checked for unmapped tools; any other name (built-ins, other servers) is never
// reported as unmapped. A new host tool in a known group exits 1: map it or add it to an ignore list with a test.
// Exit: 0 both lists empty, 1 either is non-empty, 2 bad input (file missing, fewer than 5 names, no table rows).
const fs = require('fs');

const KNOWN_GROUPS = ['mcp__ccd_', 'mcp__scheduled-tasks__'];

// Whole servers master-brain never uses.
const IGNORE_PREFIX = [
  'mcp__ccd_sidebar__', // sidebar layout, human-facing
  'mcp__ccd_window__', // window layout, human-facing
  'mcp__ccd_view__', // pane layout, human-facing
  'mcp__ccd_settings__', // settings edits are a human approval gate (law 20)
  'mcp__ccd_directory__', // the cwd is chosen by the human
  'mcp__ccd_pr__', // pull requests: master-brain never pushes
];

// Exact names (the full name must match; a sibling tool with a longer name is still reported).
const IGNORE_NAME = {
  mcp__ccd_session__: [
    'mark_chapter', // transcript chapters, cosmetic
    'read_widget_context', // inline widgets, not used by laws
    'move_to_cloud', // moving a chat is the human's call
  ],
  mcp__ccd_session_mgmt__: [
    'archive_session', // the human archives chats (law 5)
    'unarchive_session', // the human's call
    'delete_session', // destructive, never used
    'detach_session', // the human's call
    'export_transcript', // transcripts are read through list_events
    'search_session_transcripts', // history lives in files (law 6)
    'set_remote_control', // the human's call
    'set_session_output_style', // cosmetic
    'set_session_permission_mode', // settings, never changed by a Master (SAFETY 12)
    'set_session_title', // cosmetic
    'send_message', // deprecated; message = SendMessage
  ],
  mcp__ccd_host__: [
    'clean_up_worktrees', // destructive git, the human's call
    'discard_kept_worktree', // destructive git, the human's call
    'get_storage_usage', // not used by laws
    'open_in_editor', // human-facing
    'request_keep_awake', // the human's machine
    'reveal_path', // human-facing
  ],
  mcp__ccd_connectors__: [
    'reconnect_session_connector', // the human reconnects
    'session_connectors_status', // read through the connectors row
  ],
  'mcp__scheduled-tasks__': [
    'delete_scheduled_task', // one-time tasks expire; not used by laws
    'list_scheduled_tasks', // not used by laws
    'list_task_runs', // not used by laws
    'run_scheduled_task', // not used by laws
    'update_scheduled_task', // not used by laws
  ],
};

const ignoredNames = new Set(Object.entries(IGNORE_NAME).flatMap(([p, ns]) => ns.map((n) => p + n)));
const isKnown = (t) => KNOWN_GROUPS.some((g) => t.startsWith(g));
const isIgnored = (t) => ignoredNames.has(t) || IGNORE_PREFIX.some((p) => t.startsWith(p));

class InputError extends Error {}

function readText(f) {
  if (!f || !fs.existsSync(f)) throw new InputError('file missing: ' + f);
  return fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
}

// Backticked names in the Tool column (2nd cell) of every table row except the header and the separator.
function mapped(capText) {
  const rows = capText.split('\n').filter((l) => /^\|/.test(l.trim()));
  const body = rows.filter((l) => !/^\|\s*-/.test(l.trim())).slice(1);
  if (!body.length) throw new InputError('no table rows in CAPABILITIES.md');
  const out = new Set();
  for (const r of body) {
    const cell = r.split('|')[2] || '';
    for (const m of cell.matchAll(/`([^`]+)`/g)) out.add(m[1].trim());
  }
  return out;
}

function tools(listText) {
  const names = listText.split('\n').map((s) => s.trim()).filter((s) => s && !s.startsWith('#'));
  if (names.length < 5) throw new InputError(`tools.txt has ${names.length} names (need 5 or more)`);
  return new Set(names);
}

function diff(capFile, toolsFile) {
  const map = mapped(readText(capFile));
  const host = tools(readText(toolsFile));
  const missing = [...map].filter((t) => !host.has(t)).sort();
  const unmapped = [...host].filter((t) => isKnown(t) && !map.has(t) && !isIgnored(t)).sort();
  return { missing, unmapped, mapped: map.size };
}

if (require.main === module) {
  const [cmd, cap, list] = process.argv.slice(2);
  if (cmd !== 'diff' || !cap || !list) { console.error('usage: caps.cjs diff <CAPABILITIES.md> <tools.txt>'); process.exit(2); }
  try {
    const r = diff(cap, list);
    console.log(`mapped: ${r.mapped}`);
    console.log('missing: ' + r.missing.join(', '));
    console.log('unmapped: ' + r.unmapped.join(', '));
    process.exit(r.missing.length || r.unmapped.length ? 1 : 0);
  } catch (e) {
    console.error('caps: ' + e.message);
    process.exit(e instanceof InputError ? 2 : 1);
  }
}

module.exports = { diff, mapped, tools, KNOWN_GROUPS, IGNORE_PREFIX, IGNORE_NAME };
