'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

const S = path.join(__dirname, 'caps.cjs');
const FX = path.join(__dirname, 'fixtures', 'caps');
const FROZEN = path.join(FX, 'CAPABILITIES-2.3.2.md');
const HOST = path.join(FX, 'host-2026-10-19.txt');
const run = (cap, list) => cp.spawnSync('node', [S, 'diff', cap, list], { encoding: 'utf8' });
const list = (names) => { const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mb-cp-')), 'tools.txt'); fs.writeFileSync(f, names.join('\n') + '\n'); return f; };
const { mapped } = require('./caps.cjs');
const frozenMapped = () => [...mapped(fs.readFileSync(FROZEN, 'utf8'))];

test('missing mapped tool exits 1', () => {
  const names = frozenMapped().filter((t) => t !== 'SendMessage');
  const r = run(FROZEN, list(names));
  assert.strictEqual(r.status, 1);
  assert.match(r.stdout, /^missing: SendMessage$/m);
  assert.match(r.stdout, /^unmapped: $/m);
});

test('new tool in a known group is unmapped, exits 1', () => {
  const r = run(FROZEN, list([...frozenMapped(), 'mcp__ccd_session_mgmt__brand_new_tool']));
  assert.strictEqual(r.status, 1);
  assert.match(r.stdout, /^unmapped: mcp__ccd_session_mgmt__brand_new_tool$/m);
  assert.match(r.stdout, /^missing: $/m);
});

test('ignored and unknown-group tools pass, exit 0', () => {
  const extra = ['Workflow', 'Monitor', 'mcp__terminal__run_in_terminal', 'mcp__other__anything', 'mcp__ccd_sidebar__set_view',
    'mcp__ccd_pr__bind_pr', 'mcp__ccd_session__mark_chapter', 'mcp__ccd_session_mgmt__send_message', 'mcp__scheduled-tasks__list_task_runs'];
  const r = run(FROZEN, list([...frozenMapped(), ...extra]));
  assert.strictEqual(r.status, 0, r.stdout);
});

test('empty or missing tools.txt exits 2', () => {
  assert.strictEqual(run(FROZEN, list([])).status, 2);
  assert.strictEqual(run(FROZEN, list(['Agent', 'Read', 'Write', 'Bash'])).status, 2);
  assert.strictEqual(run(FROZEN, path.join(os.tmpdir(), 'mb-no-such-tools.txt')).status, 2);
  const noRows = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mb-cp-')), 'CAP.md');
  fs.writeFileSync(noRows, '# CAPABILITIES\n\nno table here\n');
  assert.strictEqual(run(noRows, HOST).status, 2);
});

test('exact-name ignore does not hide a sibling tool', () => {
  const sib = ['mcp__ccd_session_mgmt__send_message_batch', 'mcp__ccd_session__mark_chapter_v2'];
  const r = run(FROZEN, list([...frozenMapped(), 'mcp__ccd_session_mgmt__send_message', 'mcp__ccd_session__mark_chapter', ...sib]));
  assert.strictEqual(r.status, 1);
  assert.strictEqual(r.stdout.match(/^unmapped: (.*)$/m)[1], [...sib].sort().join(', '));
});

test("today's host vs frozen 2.3.2 template lists exactly the 4 new tools", () => {
  const r = run(FROZEN, HOST);
  assert.strictEqual(r.status, 1);
  assert.match(r.stdout, /^missing: $/m);
  assert.strictEqual(r.stdout.match(/^unmapped: (.*)$/m)[1], ['mcp__ccd_host__sync_with_base_branch', 'mcp__ccd_session__dismiss_task',
    'mcp__ccd_session_mgmt__get_session', 'mcp__ccd_session_mgmt__list_events'].join(', '));
});

test("today's host list exits 0 against the live template", () => {
  const r = run(path.join(__dirname, '..', 'templates', 'CAPABILITIES.md'), HOST);
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /^mapped: 17$/m);
});
