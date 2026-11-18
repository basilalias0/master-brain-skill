#!/usr/bin/env node
'use strict';
// init.cjs <master_dir>: seed a project's master-brain folder (ONBOARDING step 4). Idempotent: never overwrites a file.
// Creates STATE, ACTION_LOG (from templates/ACTION_LOG.md), FEATURE_INDEX, BOARD (QUEUE, Masters, Locks tables),
// inbox/, archive/, masters/, handoffs/ (archive/, pairs/, README.md), locks/, overlay/ (+ base.json via
// overlay.cjs rebase), improve/, routing-log.jsonl, and MODELS.md and CAPABILITIES.md copied from templates/.
// LAWS.md is not seeded: onboarding fills it with the human, then runs law-lint.cjs digest.
// Exit: 0 ok, 2 bad input.
const fs = require('fs');
const path = require('path');

const SKILL = path.join(__dirname, '..');
const tpl = (f) => fs.readFileSync(path.join(SKILL, 'templates', f), 'utf8');

const DIRS = ['inbox', 'archive', 'masters', 'handoffs/archive', 'handoffs/pairs', 'locks', 'overlay', 'improve'];
const FILES = {
  'STATE.md': () => '# STATE (rewritten in place: what is in flight now, never history)\n\nstatus: onboarding\n\n' +
    '## Handover\n- current step: onboarding\n- last decision: none\n- open decisions: none\n- others owe: none\n- next action: finish onboarding\n',
  'ACTION_LOG.md': () => tpl('ACTION_LOG.md'),
  'FEATURE_INDEX.md': () => '# FEATURE_INDEX (grep-only; entries carry the git hash and expire when it changes)\n\n' +
    '| Feature | Files | Tests | Git hash | Notes |\n|---|---|---|---|---|\n',
  'BOARD.md': () => '# BOARD\n\n## QUEUE\n| Task | Master | Worker | Lane | Touches | Status |\n|---|---|---|---|---|---|\n\n' +
    '## Masters\n| Master | Area (owned for good) | Lane | Branch | Folder | Port | Session | Status |\n|---|---|---|---|---|---|---|---|\n\n' +
    '## Locks\n| Lock | Holder | Since |\n|---|---|---|\n',
  'handoffs/README.md': () => '# handoffs\n\nOne history file per chat: `W-<Master>-<n>.md`. A LAST block on top (rewritten), entries below it ' +
    'append-only. `archive/` holds old entries (law 19); `pairs/` holds shared logs of paired chats (`C1-M2.md`).\n',
  'routing-log.jsonl': () => '',
  'MODELS.md': () => tpl('MODELS.md'),
  'CAPABILITIES.md': () => tpl('CAPABILITIES.md'),
};

function init(dir) {
  if (!dir) throw new Error('usage: init.cjs <master_dir>');
  const made = []; let kept = 0;
  fs.mkdirSync(dir, { recursive: true });
  for (const d of DIRS) {
    const p = path.join(dir, d);
    if (fs.existsSync(p)) kept++; else { fs.mkdirSync(p, { recursive: true }); made.push(d + '/'); }
  }
  for (const [f, body] of Object.entries(FILES)) {
    const p = path.join(dir, f);
    if (fs.existsSync(p)) kept++; else { fs.writeFileSync(p, body()); made.push(f); }
  }
  if (!fs.existsSync(path.join(dir, 'overlay', 'base.json'))) { require('./overlay.cjs').rebase(dir, SKILL); made.push('overlay/base.json'); } else kept++;
  return { made, kept };
}

if (require.main === module) {
  try {
    const r = init(process.argv[2]);
    console.log(r.made.length ? `init: created ${r.made.join(', ')}` : 'init: nothing to create');
    if (r.kept) console.log(`init: kept ${r.kept} existing (never overwritten)`);
  } catch (e) { console.error(String(e.message || e)); process.exit(2); }
}

module.exports = { init, DIRS, FILES };
