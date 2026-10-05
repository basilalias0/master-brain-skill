#!/usr/bin/env node
'use strict';
// budget.cjs check [root]: token budget for the skill. Sizes may not exceed budget.json caps, and a cap may not be
// raised above its baseline without a written, measured justification: { key, gain }.
// Measured: the router (SKILL.md), its description (listed in every chat), and each module's MODULE.md.
const fs = require('fs');
const path = require('path');

function measure(root) {
  const m = {};
  const skill = path.join(root, 'SKILL.md');
  if (fs.existsSync(skill)) {
    const s = fs.readFileSync(skill, 'utf8').replace(/\r\n/g, '\n');
    m.router_chars = s.length;
    const d = /^description:[ \t]*(.*)$/m.exec(s);
    m.description_chars = d ? d[1].replace(/^"|"$/g, '').length : 0;
  }
  const dir = path.join(root, 'modules');
  if (fs.existsSync(dir)) {
    for (const n of fs.readdirSync(dir)) {
      const f = path.join(dir, n, 'MODULE.md');
      if (fs.existsSync(f)) m['module_' + n] = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n').length;
    }
  }
  return m;
}

function check(root) {
  const errors = [];
  const bf = path.join(root, 'budget.json');
  if (!fs.existsSync(bf)) return ['budget.json missing'];
  const b = JSON.parse(fs.readFileSync(bf, 'utf8'));
  const m = measure(root);
  for (const [k, v] of Object.entries(m)) {
    if (b.caps[k] === undefined) errors.push(`${k}: no cap in budget.json (add one with a justification)`);
    else if (v > b.caps[k]) errors.push(`${k}: ${v} chars is over the cap ${b.caps[k]}`);
  }
  for (const [k, cap] of Object.entries(b.caps)) {
    const base = b.baseline[k];
    if (base === undefined || cap > base) {
      const j = (b.justifications || []).find((x) => x.key === k && x.gain);
      if (!j) errors.push(`${k}: cap ${cap} is above the baseline ${base === undefined ? '(none)' : base} with no justification`);
    }
  }
  return errors;
}

if (require.main === module) {
  const root = path.resolve(process.argv[3] || process.argv[2] === 'check' ? process.argv[3] || '.' : process.argv[2] || '.');
  const errors = check(root);
  if (errors.length) { console.log('budget: FAILED\n' + errors.join('\n')); process.exit(1); }
  console.log('budget: ok ' + JSON.stringify(measure(root)));
}

module.exports = { measure, check };
