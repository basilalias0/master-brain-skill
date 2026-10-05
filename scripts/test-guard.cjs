#!/usr/bin/env node
'use strict';
// test-guard.cjs snapshot <root> --out FILE | compare <root> --snap FILE
// Fails on removed tests, new skip/only markers, fewer assertions. Exit 1 on violations.
const fs = require('fs');
const path = require('path');

const SKIP = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'coverage', 'test-results', 'playwright-report']);
const isTest = (n) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(n) || /^test_.*\.py$/.test(n) || /_test\.py$/.test(n)
  || /_test\.go$/.test(n) || /Tests?\.(?:java|kt|cs)$/.test(n) || /(?:_spec|_test)\.rb$/.test(n) || /Test\.php$/.test(n);
const isRust = (f) => /\.rs$/.test(f) && /#\[(?:tokio::)?test\b/.test(fs.readFileSync(f, 'utf8'));
const count = (s, re) => (s.match(re) || []).length;

// Per-language markers. Verified by running only for JS/TS and Python; the rest are pattern-tested on snippets.
const LANG = [
  { ext: /_test\.go$/, tests: /^func\s+Test\w+\s*\(/gm, skips: /\bt\.Skip(?:Now|f)?\s*\(/g, asserts: /\bt\.(?:Error|Errorf|Fatal|Fatalf|Fail)\s*\(|\b(?:assert|require)\.\w+\s*\(/g },
  { ext: /\.(?:java|kt)$/, tests: /@(?:Parameterized)?Test\b/g, skips: /@(?:Disabled|Ignore)\b/g, asserts: /\bassert\w*\s*\(|\bverify\s*\(/g },
  { ext: /\.cs$/, tests: /\[(?:Fact|Theory|Test|TestMethod|TestCase)\b/g, skips: /Skip\s*=|\[Ignore\b/g, asserts: /\bAssert\.\w+\s*\(|\.Should\(\)/g },
  { ext: /\.rb$/, tests: /^\s*(?:[xf]?it|[xf]?specify|test)\s*[('"]|^\s*def\s+test_\w+/gm, skips: /^\s*(?:xit|xspecify|skip|pending)\b/gm, only: /\bfit\b|\bfocus:\s*true/g, asserts: /\bexpect\s*[({]|\bassert\w*[\s(]|\.should\b/g },
  { ext: /\.php$/, tests: /function\s+test\w+\s*\(|@test\b/g, skips: /markTestSkipped|markTestIncomplete/g, asserts: /\$this->assert\w+\s*\(|\bexpect\s*\(/g },
  { ext: /\.rs$/, tests: /#\[(?:tokio::)?test\b/g, skips: /#\[ignore\b/g, asserts: /\bassert(?:_eq|_ne)?!\s*\(/g },
];

function walk(root, out = []) {
  for (const e of fs.readdirSync(root, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(root, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (isTest(e.name) || isRust(p)) out.push(p);
  }
  return out;
}

function scan(file) {
  const s = fs.readFileSync(file, 'utf8');
  const lang = LANG.find((l) => l.ext.test(file));
  if (lang) return { tests: count(s, lang.tests), skips: count(s, lang.skips), only: lang.only ? count(s, lang.only) : 0, asserts: count(s, lang.asserts) };
  return {
    tests: count(s, /\b(?:it|test)(?:\.(?:only|skip|fixme))?\s*\(/g) + count(s, /^\s*(?:async\s+)?def\s+test_\w+/gm),
    skips: count(s, /\b(?:it|test|describe)\.(?:skip|fixme)\b|\bxit\s*\(|\bxdescribe\s*\(|@pytest\.mark\.skip|\bunittest\.skip|\b(?:skip|todo)\s*:\s*(?:true|['"`])|\bt\.(?:skip|todo)\s*\(|\.todo\s*\(|\bself\.skipTest\s*\(|\bpytest\.skip\s*\(/g),
    only: count(s, /\b(?:it|test|describe)\.only\b/g),
    asserts: count(s, /\bexpect\s*\(|\bassert[\w.]*\s*\(|^\s*assert\s/gm),
  };
}

function snapshot(root) {
  const snap = {};
  for (const f of walk(root)) snap[path.relative(root, f).replace(/\\/g, '/')] = scan(f);
  return snap;
}

function compare(root, snap) {
  const now = snapshot(root);
  const v = [];
  for (const [f, a] of Object.entries(snap)) {
    const b = now[f];
    if (!b) { v.push(`${f}: test file removed`); continue; }
    if (b.tests < a.tests) v.push(`${f}: tests ${a.tests} -> ${b.tests}`);
    if (b.skips > a.skips) v.push(`${f}: skip/fixme markers ${a.skips} -> ${b.skips}`);
    if (b.only > a.only) v.push(`${f}: .only added`);
    if (b.asserts < a.asserts) v.push(`${f}: assertions ${a.asserts} -> ${b.asserts}`);
  }
  return v;
}

if (require.main === module) {
  const [cmd, root = '.'] = process.argv.slice(2);
  const flag = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
  if (cmd === 'snapshot') {
    const out = flag('--out');
    if (!out) { console.error('--out FILE required'); process.exit(2); }
    const s = snapshot(root);
    fs.writeFileSync(out, JSON.stringify(s, null, 1));
    console.log(`snapshot: ${Object.keys(s).length} test files -> ${out}`);
  } else if (cmd === 'compare') {
    const sf = flag('--snap');
    if (!sf) { console.error('--snap FILE required'); process.exit(2); }
    const v = compare(root, JSON.parse(fs.readFileSync(sf, 'utf8')));
    if (v.length) { console.log('test-guard: VIOLATIONS\n' + v.join('\n')); process.exit(1); }
    console.log('test-guard: ok');
  } else { console.error('usage: test-guard.cjs snapshot|compare <root> --out|--snap FILE'); process.exit(2); }
}

module.exports = { snapshot, compare, scan };
