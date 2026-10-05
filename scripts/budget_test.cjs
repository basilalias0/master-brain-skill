'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { check, measure } = require('./budget.cjs');

function repo(budget, moduleText = 'x'.repeat(100)) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mb-bg-'));
  fs.writeFileSync(path.join(d, 'SKILL.md'), '---\nname: t\ndescription: "short"\n---\n' + 'r'.repeat(50));
  fs.mkdirSync(path.join(d, 'modules', 'lean'), { recursive: true });
  fs.writeFileSync(path.join(d, 'modules', 'lean', 'MODULE.md'), moduleText);
  fs.writeFileSync(path.join(d, 'budget.json'), JSON.stringify(budget));
  return d;
}
const caps = { router_chars: 200, description_chars: 300, module_lean: 100 };

test('sizes at or under the caps pass', () => {
  const d = repo({ baseline: caps, caps, justifications: [] });
  assert.deepStrictEqual(check(d), []);
  assert.strictEqual(measure(d).module_lean, 100);
});

test('a module over its cap fails; a module with no cap fails', () => {
  assert.match(check(repo({ baseline: caps, caps, justifications: [] }, 'x'.repeat(101)))[0], /over the cap/);
  const d = repo({ baseline: { router_chars: 200, description_chars: 300 }, caps: { router_chars: 200, description_chars: 300 }, justifications: [] });
  assert.match(check(d)[0], /no cap/);
});

test('raising a cap above the baseline needs a justification with a gain', () => {
  const raised = { ...caps, module_lean: 150 };
  const d = repo({ baseline: caps, caps: raised, justifications: [] }, 'x'.repeat(120));
  assert.match(check(d).join('|'), /no justification/);
  const ok = repo({ baseline: caps, caps: raised, justifications: [{ key: 'module_lean', gain: 'fewer retries: 12% fewer turns on t3' }] }, 'x'.repeat(120));
  assert.deepStrictEqual(check(ok), []);
});
