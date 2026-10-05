'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ov = require('./overlay.cjs');

function setup() {
  const t = fs.mkdtempSync(path.join(os.tmpdir(), 'mb-ov-'));
  const skill = path.join(t, 'skill');
  fs.mkdirSync(path.join(skill, 'modules', 'tester'), { recursive: true });
  fs.writeFileSync(path.join(skill, 'modules', 'tester', 'MODULE.md'), 'Query by role or label. Mock at the network boundary.');
  fs.writeFileSync(path.join(skill, 'VERSION'), '2.0.0\n');
  fs.writeFileSync(path.join(skill, 'CHANGELOG.md'), '## 2.0.0\n- tester: counts assertions\n');
  return { dir: path.join(t, 'mb'), skill };
}

test('add, list, retire; unknown module and missing evidence are refused', () => {
  const { dir, skill } = setup();
  const e = ov.add(dir, skill, 'tester', 'Seed the database through the fixture loader', 'failed 3 runs on 2026-09-01');
  assert.strictEqual(e.id, 'ov-1');
  assert.strictEqual(ov.add(dir, skill, 'tester', 'Use the shared login helper', 'saved 4 turns').id, 'ov-2');
  assert.strictEqual(ov.all(dir).length, 2);
  ov.retire(dir, 'ov-1');
  assert.strictEqual(ov.all(dir).find((x) => x.id === 'ov-1').status, 'retired');
  assert.throws(() => ov.add(dir, skill, 'nope', 'a', 'b'), /unknown module/);
  assert.throws(() => ov.add(dir, skill, 'tester', 'a rule', ''), /required/);
});

test('rules that relax safety, tests, locks or approvals are rejected', () => {
  const { dir, skill } = setup();
  for (const r of ['Skip tests for small changes', 'You can push without asking', 'Tests are optional for docs', 'Bypass the lock when in a hurry', 'auto-approve migrations']) {
    assert.throws(() => ov.add(dir, skill, 'tester', r, 'x'), /relax safety/, r);
  }
  assert.ok(ov.add(dir, skill, 'tester', 'Run the login flow test before any auth change', 'caught 2 bugs'));
});

test('addendum cap is enforced per module', () => {
  const { dir, skill } = setup();
  ov.add(dir, skill, 'tester', 'a'.repeat(1400), 'e');
  assert.throws(() => ov.add(dir, skill, 'tester', 'b'.repeat(200), 'e'), /cap/);
});

test('check recommends keep, both or adopt by overlap with the installed text', () => {
  const { dir, skill } = setup();
  ov.add(dir, skill, 'tester', 'Seed fixtures through the project loader', 'e');
  ov.add(dir, skill, 'tester', 'Query by role or label and mock at the network boundary', 'e');
  const out = ov.check(dir, skill).join('\n');
  assert.match(out, /base none -> installed 2.0.0/);
  assert.match(out, /ov-1 .*keep/);
  assert.match(out, /ov-2 .*adopt/);
  ov.rebase(dir, skill);
  assert.match(ov.check(dir, skill)[0], /base 2.0.0/);
});

test('export keeps only general rules, strips evidence, refuses paths and secrets', () => {
  const { dir, skill } = setup();
  ov.add(dir, skill, 'tester', 'Local rule for this project', 'e1');
  ov.add(dir, skill, 'tester', 'Wait for the network idle event, not a timer', 'saw it flake 5 times in C:/Users/me/proj', 'general');
  const x = ov.exportRules(dir);
  assert.strictEqual(x.rules.length, 1);
  assert.ok(!JSON.stringify(x).includes('Users'));
  ov.add(dir, skill, 'tester', 'Read config from C:/Users/me/app', 'e', 'general');
  assert.throws(() => ov.exportRules(dir), /local path/);
});
