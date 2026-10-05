#!/usr/bin/env node
'use strict';
// codemap.cjs build <root> [--out FILE] [--alias PREFIX=DIR]   (alias example: "@/=src/")
//             lookup <FILE> <symbol-or-path-fragment>
//             check <FILE> <root>                              (exit 3 when the git hash changed)
// Regex-based JS/TS index: exports with line numbers, imports, importers. Not a parser; verify by reading the lines.
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const SKIP = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'coverage', 'out']);
const EXT = /\.(?:tsx?|jsx?|mjs|cjs)$/;
const TRY = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '/index.ts', '/index.tsx', '/index.js'];

function gitHash(root) {
  try { return cp.execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return 'nogit'; }
}

function collect(root, out = []) {
  for (const e of fs.readdirSync(root, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(root, e.name);
    if (e.isDirectory()) collect(p, out); else if (EXT.test(e.name)) out.push(p);
  }
  return out;
}

function build(root, alias) {
  const abs = collect(root);
  const set = new Set(abs.map((f) => f.replace(/\\/g, '/')));
  const resolve = (from, spec) => {
    let base;
    if (spec.startsWith('.')) base = path.resolve(path.dirname(from), spec);
    else if (alias && spec.startsWith(alias[0])) base = path.resolve(root, alias[1], spec.slice(alias[0].length));
    else return null;
    base = base.replace(/\\/g, '/');
    for (const t of TRY) if (set.has(base + t)) return base + t;
    return null;
  };
  const files = {};
  const rel = (f) => path.relative(root, f).replace(/\\/g, '/');
  for (const f of abs) {
    const text = fs.readFileSync(f, 'utf8');
    const ls = text.split('\n');
    const exports = [];
    ls.forEach((l, i) => {
      const m = /^\s*export\s+(?:default\s+)?(?:async\s+)?(?:function\*?|class|const|let|var|type|interface|enum)\s+([A-Za-z_$][\w$]*)/.exec(l)
        || /^\s*(?:module\.)?exports\.([A-Za-z_$][\w$]*)\s*=/.exec(l);
      if (m) exports.push({ n: m[1], l: i + 1 });
    });
    const imports = new Set();
    const re = /(?:import|export)\s[^'";]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\)/g;
    let m;
    while ((m = re.exec(text))) { const r = resolve(f, m[1] || m[2] || m[3]); if (r) imports.add(rel(r)); }
    files[rel(f)] = { lines: ls.length, exports, imports: [...imports], importers: [] };
  }
  for (const [f, v] of Object.entries(files)) for (const i of v.imports) if (files[i]) files[i].importers.push(f);
  return { hash: gitHash(root), built: new Date().toISOString(), files };
}

function lookup(map, q) {
  const out = [];
  for (const [f, v] of Object.entries(map.files)) {
    const hit = v.exports.filter((e) => e.n === q);
    if (hit.length) out.push(...hit.map((e) => `${f}:${e.l} export ${e.n} | importers(${v.importers.length}): ${v.importers.slice(0, 12).join(', ')}`));
    else if (f.includes(q)) out.push(`${f} (${v.lines} lines) exports: ${v.exports.map((e) => `${e.n}@${e.l}`).join(', ') || '-'} | imports: ${v.imports.length} | importers(${v.importers.length}): ${v.importers.slice(0, 12).join(', ')}`);
  }
  return out.slice(0, 25);
}

if (require.main === module) {
  const [cmd, a, b] = process.argv.slice(2);
  const flag = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
  if (cmd === 'build') {
    const al = flag('--alias');
    const map = build(a || '.', al ? al.split('=') : null);
    const outFile = flag('--out') || path.join(a || '.', 'codemap.json');
    fs.writeFileSync(outFile, JSON.stringify(map));
    console.log(`codemap: ${Object.keys(map.files).length} files, hash ${map.hash.slice(0, 12)} -> ${outFile}`);
  } else if (cmd === 'lookup' && a && b) {
    const r = lookup(JSON.parse(fs.readFileSync(a, 'utf8')), b);
    console.log(r.length ? r.join('\n') : 'no match');
  } else if (cmd === 'check' && a && b) {
    const map = JSON.parse(fs.readFileSync(a, 'utf8'));
    if (map.hash !== gitHash(b)) { console.log('codemap STALE: rebuild'); process.exit(3); }
    console.log('codemap fresh');
  } else { console.error('usage: codemap.cjs build <root> [--out F] [--alias P=D] | lookup <F> <q> | check <F> <root>'); process.exit(2); }
}

module.exports = { build, lookup };
