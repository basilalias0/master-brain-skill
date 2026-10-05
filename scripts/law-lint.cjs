#!/usr/bin/env node
'use strict';
// law-lint.cjs caps <root> [--exempt FILE] | stamp <LAWS> <DIGEST> | digest-check <LAWS> <DIGEST>
// caps: .md 200 lines, .ts/.tsx 400, .js/.jsx/.cjs/.mjs 300. Exempt file: one path prefix per line.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SKIP = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'coverage', 'archive']);
const cap = (f) => (/\.md$/.test(f) ? 200 : /\.tsx?$/.test(f) ? 400 : /\.(?:[cm]?jsx?)$/.test(f) ? 300 : 0);
const lines = (f) => fs.readFileSync(f, 'utf8').split('\n').length - (fs.readFileSync(f, 'utf8').endsWith('\n') ? 1 : 0);
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

function caps(root, exemptFile) {
  const ex = exemptFile && fs.existsSync(exemptFile)
    ? fs.readFileSync(exemptFile, 'utf8').split('\n').map((s) => s.trim()).filter((s) => s && !s.startsWith('#')) : [];
  const bad = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (SKIP.has(e.name)) continue;
      const p = path.join(d, e.name);
      const rel = path.relative(root, p).replace(/\\/g, '/');
      if (ex.some((x) => rel === x || rel.startsWith(x.replace(/\/?$/, '/')))) continue;
      if (e.isDirectory()) walk(p);
      else { const c = cap(e.name); if (c) { const n = lines(p); if (n > c) bad.push(`${rel}: ${n} lines (cap ${c})`); } }
    }
  })(root);
  return bad;
}

function digestHash(digest) {
  const m = /^source_hash:\s*([0-9a-f]{64})\s*$/m.exec(fs.readFileSync(digest, 'utf8'));
  return m ? m[1] : null;
}

function stamp(laws, digest) {
  let s = fs.readFileSync(digest, 'utf8');
  const line = `source_hash: ${sha(laws)}`;
  s = /^source_hash:.*$/m.test(s) ? s.replace(/^source_hash:.*$/m, line) : s.replace(/^(# .*\n)/, `$1${line}\n`);
  fs.writeFileSync(digest, s);
}

if (require.main === module) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'caps') {
    const i = process.argv.indexOf('--exempt');
    const bad = caps(a || '.', i > 0 ? process.argv[i + 1] : null);
    if (bad.length) { console.log('law-lint: over cap\n' + bad.join('\n')); process.exit(1); }
    console.log('law-lint: ok');
  } else if (cmd === 'stamp' && a && b) { stamp(a, b); console.log('stamped ' + b);
  } else if (cmd === 'digest-check' && a && b) {
    const h = digestHash(b);
    if (h !== sha(a)) { console.log('digest STALE: re-read the full LAWS and refresh the digest'); process.exit(1); }
    console.log('digest ok');
  } else { console.error('usage: law-lint.cjs caps <root> [--exempt FILE] | stamp|digest-check <LAWS> <DIGEST>'); process.exit(2); }
}

module.exports = { caps, stamp, digestHash, sha };
