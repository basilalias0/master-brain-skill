'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { help } = require('./help.cjs');

test('the index lists every module and its use line in a short page', () => {
  const t = help();
  for (const m of ['research', 'lean', 'developer', 'analyzer', 'tester']) assert.match(t, new RegExp(m));
  for (const s of ['status', 'onboard', 'improve', 'update', 'overlay', 'contribute', 'audit']) assert.match(t, new RegExp(s));
  assert.match(t, /\/master-brain lean \[lite\|full\|ultra\]/);
  assert.ok(t.split('\n').length <= 45, 'index must stay short');
});

test('help <name> works for modules, aliases and subcommands; flags show the index', () => {
  assert.match(help('tester'), /Languages:/);
  assert.match(help('test'), /Languages:/);
  assert.match(help('analyze'), /read-only/);
  assert.match(help('update'), /git pull --ff-only/);
  assert.strictEqual(help('-help'), help());
  assert.strictEqual(help('--help'), help());
});

test('unknown names list what exists', () => {
  assert.match(help('nope'), /^No help for "nope"\. Try: .*lean/);
});
