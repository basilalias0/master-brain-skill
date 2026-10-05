'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { snapshot, compare } = require('./test-guard.cjs');

function fixture() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mb-tg-'));
  fs.writeFileSync(path.join(d, 'a.test.js'), "test('one', () => { expect(1).toBe(1); });\ntest('two', () => { expect(2).toBe(2); });\n");
  return d;
}

test('unchanged tree passes', () => {
  const d = fixture();
  assert.deepStrictEqual(compare(d, snapshot(d)), []);
});

test('removed test, new skip, fewer assertions all fail', () => {
  const d = fixture();
  const snap = snapshot(d);
  fs.writeFileSync(path.join(d, 'a.test.js'), "test.skip('one', () => {});\n");
  const v = compare(d, snap).join('|');
  assert.match(v, /tests 2 -> 1/);
  assert.match(v, /skip/);
  assert.match(v, /assertions/);
});

test('removed file fails; added tests pass', () => {
  const d = fixture();
  const snap = snapshot(d);
  fs.writeFileSync(path.join(d, 'b.test.js'), "test('x', () => { expect(1).toBe(1); });\n");
  assert.deepStrictEqual(compare(d, snap), []);
  fs.rmSync(path.join(d, 'a.test.js'));
  assert.match(compare(d, snap)[0], /removed/);
});

const { scan } = require('./test-guard.cjs');
const one = (name, text) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mb-tgl-'));
  fs.writeFileSync(path.join(d, name), text);
  return scan(path.join(d, name));
};

test('other languages: tests, skips and assertions are counted (pattern-tested)', () => {
  assert.deepStrictEqual(one('a_test.go', 'func TestA(t *testing.T) {\n t.Skip("x")\n if 1 != 2 { t.Errorf("bad") }\n}\n'), { tests: 1, skips: 1, only: 0, asserts: 1 });
  assert.deepStrictEqual(one('AThing.java'.replace('AThing', 'AuthTest'), '@Test\nvoid a(){ assertEquals(1,1); }\n@Disabled @Test void b(){}\n'), { tests: 2, skips: 1, only: 0, asserts: 1 });
  assert.deepStrictEqual(one('AuthTests.cs', '[Fact]\npublic void A(){ Assert.Equal(1,1); }\n[Fact(Skip = "x")]\npublic void B(){}\n'), { tests: 2, skips: 1, only: 0, asserts: 1 });
  assert.deepStrictEqual(one('a_spec.rb', "it 'a' do\n expect(1).to eq(1)\nend\nxit 'b' do\nend\nfit 'c' do\nend\n"), { tests: 3, skips: 1, only: 1, asserts: 1 });
  assert.deepStrictEqual(one('AuthTest.php', '<?php\nfunction testA(){ $this->assertTrue(true); $this->markTestSkipped(); }\n'), { tests: 1, skips: 1, only: 0, asserts: 1 });
  assert.deepStrictEqual(one('lib.rs', '#[test]\nfn a(){ assert_eq!(1,1); }\n#[test]\n#[ignore]\nfn b(){}\n'), { tests: 2, skips: 1, only: 0, asserts: 1 });
});

test('a Rust file without tests is not a test file; deleting a Go test is caught', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mb-tgr-'));
  fs.writeFileSync(path.join(d, 'main.rs'), 'fn main() {}\n');
  fs.writeFileSync(path.join(d, 'a_test.go'), 'func TestA(t *testing.T) { t.Fatal("x") }\nfunc TestB(t *testing.T) { t.Fatal("y") }\n');
  const snap = snapshot(d);
  assert.deepStrictEqual(Object.keys(snap), ['a_test.go']);
  fs.writeFileSync(path.join(d, 'a_test.go'), 'func TestA(t *testing.T) { t.Fatal("x") }\n');
  assert.match(compare(d, snap).join('|'), /tests 2 -> 1/);
});

test('skip forms found by running Node and Python are counted (matches the runners)', () => {
  const js = "test('a', () => { assert.ok(1); });\ntest('b', { skip: true }, () => {});\ntest('c', (t) => { t.skip('x'); });\ntest('d', { todo: 'x' }, () => {});\n";
  assert.deepStrictEqual(one('a.test.js', js), { tests: 4, skips: 3, only: 0, asserts: 1 });
  const py = 'class A(unittest.TestCase):\n    def test_one(self): self.assertEqual(1, 1)\n    def test_two(self): self.skipTest("x")\n    @unittest.skipIf(True, "x")\n    def test_three(self): pass\n';
  assert.deepStrictEqual(one('test_a.py', py), { tests: 3, skips: 2, only: 0, asserts: 1 });
});

test('safety net: an unlisted skip form raises a "possible new skip form" flag', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mb-tgh-'));
  fs.writeFileSync(path.join(d, 'a.test.js'), "test('a', () => { expect(1).toBe(1); });\n");
  const snap = snapshot(d);
  fs.writeFileSync(path.join(d, 'a.test.js'), "test('a', () => { expect(1).toBe(1); });\nmyRunner.disabled('b');\n");
  assert.match(compare(d, snap).join('|'), /possible new skip form/);
});

test('forms found by running the real runners: rspec metadata, JUnit assumptions, NUnit ignore, PHP requires', () => {
  assert.strictEqual(one('a_spec.rb', "it 'a', :skip do\nend\nit 'b', skip: true do\nend\n").skips, 2);
  assert.strictEqual(one('ATest.java', '@Test void a() { Assumptions.assumeTrue(false); }\n@DisabledOnOs(OS.WINDOWS) @Test void b() {}\n').skips, 2);
  assert.strictEqual(one('ATests.cs', '[Test] public void A() { Assert.Ignore("x"); }\n').skips, 1);
  assert.strictEqual(one('ATest.php', '#[RequiresPhp(">=99")] public function testA() {}\n').skips, 1);
});
