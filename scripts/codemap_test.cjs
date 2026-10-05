'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { build, lookup } = require('./codemap.cjs');

function fixture() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mb-cm-'));
  fs.mkdirSync(path.join(d, 'src', 'lib'), { recursive: true });
  fs.writeFileSync(path.join(d, 'src', 'lib', 'util.ts'), 'export function helper() {}\nexport const X = 1;\n');
  fs.writeFileSync(path.join(d, 'src', 'a.ts'), "import { helper } from './lib/util';\nexport function a() { helper(); }\n");
  fs.writeFileSync(path.join(d, 'src', 'b.ts'), "import { helper } from '@/lib/util';\nconst c = require('./a');\n");
  return d;
}

test('indexes exports with lines and links importers (relative and alias)', () => {
  const d = fixture();
  const map = build(d, ['@/', 'src/']);
  const util = map.files['src/lib/util.ts'];
  assert.deepStrictEqual(util.exports.map((e) => `${e.n}@${e.l}`), ['helper@1', 'X@2']);
  assert.deepStrictEqual(util.importers.sort(), ['src/a.ts', 'src/b.ts']);
  assert.deepStrictEqual(map.files['src/a.ts'].importers, ['src/b.ts']);
});

test('lookup finds a symbol and a path fragment', () => {
  const map = build(fixture(), ['@/', 'src/']);
  assert.match(lookup(map, 'helper')[0], /src\/lib\/util\.ts:1 export helper \| importers\(2\)/);
  assert.match(lookup(map, 'a.ts')[0], /src\/a\.ts/);
  assert.deepStrictEqual(lookup(map, 'nothing-here'), []);
});
