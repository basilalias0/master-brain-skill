'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

test('arena log line from procedure 05 is accepted', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'procedure', '05-arena-and-decisions.md'), 'utf8');
  const line = text.split('\n').find((l) => /route-log\.cjs append/.test(l) && /--task arena/.test(l));
  assert.ok(line, 'procedure 05 has the arena route-log line');
  const cmd = /`(node scripts\/route-log\.cjs append [^`]+)`/.exec(line)[1];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mb-rl-'));
  const filled = cmd.replace('<master_dir>', dir).replace('pass|fail', 'pass').replace('<integer>', '2400000');
  const args = (filled.match(/"[^"]*"|\S+/g) || []).map((a) => a.replace(/^"|"$/g, ''));
  assert.strictEqual(args[0], 'node');
  args[1] = path.join(__dirname, 'route-log.cjs');
  const r = cp.spawnSync('node', args.slice(1), { encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stderr);
  const row = JSON.parse(fs.readFileSync(path.join(dir, 'routing-log.jsonl'), 'utf8').trim());
  assert.strictEqual(row.task, 'arena');
  assert.strictEqual(row.tokens, 2400000);
});
