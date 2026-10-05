#!/usr/bin/env node
'use strict';
// failure-case.cjs add --dir DIR --id ID --task TEXT --wrong TEXT --expected TEXT [--dl DL-012] [--skills a,b]
// failure-case.cjs list --dir DIR
// A case card records a real mistake so it can become a regression test in the A/B harness later.
const fs = require('fs');
const path = require('path');

function add(dir, o) {
  if (!/^[a-z0-9-]{1,40}$/.test(o.id || '')) throw new Error('--id must be a short lowercase key');
  for (const k of ['task', 'wrong', 'expected']) if (!o[k]) throw new Error(`--${k} is required`);
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, o.id + '.md');
  if (fs.existsSync(f)) throw new Error('case already exists: ' + o.id);
  const oneLine = (s) => String(s).replace(/[\r\n]+/g, ' ').slice(0, 400);
  fs.writeFileSync(f, [
    `# Case ${o.id}`, '',
    `date: ${new Date().toISOString().slice(0, 10)}`, `source: ${o.dl || 'none'}`, `skills: ${o.skills || 'none'}`, 'status: new (not yet a harness task)', '',
    '## Task given', oneLine(o.task), '', '## What went wrong', oneLine(o.wrong), '', '## Pass means', oneLine(o.expected), '',
    '## To turn into a harness task', 'Write a hidden test that fails on the wrong behavior and passes on the right one, add it to the fixture, then add the task to the harness.', '',
  ].join('\n'));
  return f;
}

function list(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => {
    const s = fs.readFileSync(path.join(dir, f), 'utf8');
    return `${f.replace(/\.md$/, '')}: ${(/^status: (.*)$/m.exec(s) || [])[1] || '?'}`;
  });
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const o = {};
  for (let i = 1; i < argv.length; i += 2) o[argv[i].replace(/^--/, '')] = argv[i + 1];
  if (!o.dir || !['add', 'list'].includes(argv[0])) { console.error('usage: failure-case.cjs add|list --dir DIR [--id --task --wrong --expected --dl --skills]'); process.exit(2); }
  try {
    if (argv[0] === 'add') console.log('case written: ' + add(o.dir, o));
    else console.log(list(o.dir).join('\n') || 'no cases');
  } catch (e) { console.error('failure-case: ' + e.message); process.exit(2); }
}

module.exports = { add, list };
