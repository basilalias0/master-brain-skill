'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const { bodyHash } = require('./drift.cjs');

const S = path.join(__dirname, 'drift.cjs');
const BODY = '\n## Goal\nA small synthetic spec.\n\n## Rules\n- one rule\n';
function spec(changes, { body = BODY, hashOf = BODY, locked = true } = {}) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mb-dr-'));
  const h = bodyHash(hashOf.trim()); // body: lines after body_sha256 up to the change log, trimmed
  const head = locked ? `# Spec\nStatus: LOCKED 2026-10-01\nbody_sha256: ${h}` : `# Spec\nStatus: draft\nbody_sha256: ${h}`;
  fs.writeFileSync(path.join(d, 'spec.md'), `${head}${body}## Change log\n${changes.join('\n')}\n`);
  return d;
}
const run = (d, ...a) => cp.spawnSync('node', [S, 'check', d, '--today', '2026-10-10', ...a], { encoding: 'utf8' });

test('counts lines since last fold marker', () => {
  const d = spec(['- 2026-10-01 CL-1: old', '- 2026-10-02 CL-2: old', '<!-- folded 2026-10-03 -->', '- 2026-10-04 CL-3: new', '- 2026-10-05 CL-4: new']);
  const r = run(d);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, /spec\.md: 2 change lines since last fold, oldest 2026-10-04$/m);
  assert.doesNotMatch(r.stdout, /fold due|edited/);
});

test('fold due at 5 lines or 14 days', () => {
  const five = spec(['1', '2', '3', '4', '5'].map((n) => `- 2026-10-09 CL-${n}: x`));
  assert.match(run(five).stdout, /5 change lines.*fold due/);
  assert.strictEqual(run(five, '--strict').status, 1);
  const four = spec(['1', '2', '3', '4'].map((n) => `- 2026-10-09 CL-${n}: x`));
  assert.doesNotMatch(run(four).stdout, /fold due/);
  const old = spec(['- 2026-09-26 CL-1: x']);
  assert.match(run(old).stdout, /oldest 2026-09-26; fold due/);
  assert.doesNotMatch(run(spec(['- 2026-09-27 CL-1: x'])).stdout, /fold due/);
});

test('body hash mismatch is reported', () => {
  const d = spec(['- 2026-10-09 CL-1: x'], { body: BODY.replace('one rule', 'one changed rule') });
  const r = run(d);
  assert.strictEqual(r.status, 0);
  assert.match(r.stdout, /body edited after lock/);
  assert.strictEqual(run(d, '--strict').status, 1);
  assert.doesNotMatch(run(spec(['- 2026-10-09 CL-1: x'])).stdout, /edited/);
});

test('malformed change line exits 2', () => {
  assert.strictEqual(run(spec(['- 2026-10-09 CL-1: fine', 'free text under the log'])).status, 2);
  assert.strictEqual(run(spec(['- 2026-13-40 CL-1: bad date'])).status, 2);
  assert.strictEqual(run(spec(['- 2026-10-09 change without id'])).status, 2);
});

test('unlocked spec is skipped', () => {
  const d = spec(['not a change line at all'], { locked: false, body: 'edited' });
  const r = run(d, '--strict');
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, /spec\.md: unlocked, skipped/);
});
