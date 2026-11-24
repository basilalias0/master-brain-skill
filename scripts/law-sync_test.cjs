'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { sync, historyAdd } = require('./law-lint.cjs');
const { compare, snapshot } = require('./test-guard.cjs');

const doc = (laws) => `# LAWS\n\n## The laws\n${laws.join('\n')}\n\n## This project\n- kept\n`;
const OLD = ['1. **Plan.** The Master plans.', '2. **Tests.** Run `{{full E2E command}}` once per phase.', '3. **Push.** Merge to `{{main branch}}`.'];
const NEW = ['1. **Plan.** The Master plans.', '2. **Scope.** Each chat tests its own change; the top runs `{{full E2E command}}`.', '3. **Push.** Merge to `{{main branch}}`.', '4. **Clean.** Remove merged worktrees.'];

function setup(project) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mb-sync-'));
  const f = (n, s) => { fs.writeFileSync(path.join(d, n), s); return path.join(d, n); };
  const old = f('old.md', doc(OLD)); const tpl = f('tpl.md', doc(NEW));
  const hist = path.join(d, 'h.json'); historyAdd(old, tpl, hist);
  return { d, tpl, hist, proj: f('LAWS.md', doc(project)) };
}

test('an unedited old law is updated with the project values; an edited one is left alone; a missing one is added', () => {
  const s = setup(['1. **Plan.** The Master plans, with the human.', '2. **Tests.** Run `npm run e2e` once per phase.', '3. **Push.** Merge to `develop`.']);
  const dry = sync(s.proj, s.tpl, s.hist);
  assert.deepStrictEqual([dry.ok, dry.outdated, dry.custom, dry.missing], [['3'], ['2'], ['1'], ['4']]);
  const r = sync(s.proj, s.tpl, s.hist, { apply: true });
  const out = fs.readFileSync(s.proj, 'utf8');
  assert.match(out, /2\. \*\*Scope\.\*\* Each chat tests its own change; the top runs `npm run e2e`\./);
  assert.match(out, /The Master plans, with the human\./, 'the human edit stays');
  assert.match(out, /4\. \*\*Clean\.\*\*[\s\S]*## This project\n- kept/, 'added inside the laws section, the rest kept');
  assert.ok(fs.existsSync(path.join(s.d, 'LAWS.prev.md')) && fs.existsSync(path.join(s.d, 'LAWS_DIGEST.md')));
  assert.deepStrictEqual(r.unfilled, []);
  const again = sync(s.proj, s.tpl, s.hist);
  assert.deepStrictEqual([again.outdated, again.missing], [[], []], 'a second run changes nothing');
});

test('history skips renumbered laws but keeps a law renamed in place', () => {
  const s = setup([]);
  const h = JSON.parse(fs.readFileSync(s.hist, 'utf8')).laws;
  assert.deepStrictEqual(Object.keys(h), ['2'], 'law 2 was renamed in place; laws 1 and 3 did not change');
  const shifted = path.join(s.d, 'shift.md'); fs.writeFileSync(shifted, doc(['1. **Plan.** x', '2. **Push.** y', '3. **Tests.** z']));
  historyAdd(shifted, s.tpl, s.hist);
  const h2 = JSON.parse(fs.readFileSync(s.hist, 'utf8')).laws;
  assert.ok(!h2['3'] && !h2['2'].some((t) => /Push/.test(t)), 'a shift means renumbering, not an older text');
});

test('the shipped template and history: the onboarded fixture is current, and the skill knows the 2.8.0 law 7', () => {
  const root = path.join(__dirname, '..');
  const r = sync(path.join(__dirname, 'fixtures', 'onboarded', 'master-brain', 'LAWS.md'), path.join(root, 'templates', 'LAWS.md'), path.join(root, 'templates', 'laws-history.json'));
  assert.deepStrictEqual([r.outdated, r.missing, r.custom], [[], [], []]);
  const h = JSON.parse(fs.readFileSync(path.join(root, 'templates', 'laws-history.json'), 'utf8')).laws;
  assert.ok(h['7'].some((t) => /One batched full E2E in the heavy slot/.test(t)));
});

test('test-guard --expect-new fails a change that adds no test', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mb-tg-'));
  fs.mkdirSync(path.join(d, 'tests'));
  fs.writeFileSync(path.join(d, 'tests', 'a.test.js'), "test('a', () => { assert.ok(1); });\n");
  const snap = snapshot(d);
  assert.deepStrictEqual(compare(d, snap), []);
  assert.match(compare(d, snap, { expectNew: true })[0], /no new tests/);
  fs.writeFileSync(path.join(d, 'tests', 'b.test.js'), "test('b', () => { assert.ok(1); });\n");
  assert.deepStrictEqual(compare(d, snap, { expectNew: true }), []);
});
