#!/usr/bin/env node
'use strict';
// verify.cjs [root]   Repo self-check before a push. Exit 1 on any error.
// Optional: .lintexempt (path prefixes exempt from line caps and text checks, e.g. a third-party folder),
// env MB_DENY="word1,word2" (case-insensitive words that must not appear: project or company names).
const fs = require('fs');
const path = require('path');

const root = path.resolve(process.argv[2] || '.');
const SKIP = new Set(['node_modules', '.git']);
const TEXT = /\.(?:md|json|cjs|mjs|js|txt|ya?ml)$/;
const errors = [];
const warns = [];
const err = (f, n, m) => errors.push(`${f}${n ? ':' + n : ''}: ${m}`);

const exemptFile = path.join(root, '.lintexempt');
const exempt = fs.existsSync(exemptFile)
  ? fs.readFileSync(exemptFile, 'utf8').split('\n').map((s) => s.trim()).filter((s) => s && !s.startsWith('#')) : [];
const isExempt = (rel) => exempt.some((x) => rel === x || rel.startsWith(x.replace(/\/?$/, '/')));

const all = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p); else all.push(p);
  }
})(root);

const rel = (f) => path.relative(root, f).replace(/\\/g, '/');
const modelRe = new RegExp('\\b(?:' + ['Haik', 'Sonn', 'Opu', 'Fabl'].map((s) => s + ['u', 'et', 's', 'e'][['Haik', 'Sonn', 'Opu', 'Fabl'].indexOf(s)]).join('|') + ')\\b', 'i');
const pathRe = new RegExp('(?<![A-Za-z])[A-Za-z]:[\\\\/]|/(?:Users|home)/[\\w.-]+');
const secretRes = [
  new RegExp('-----BEGIN [A-Z ]*PRIVATE KEY-----'),
  new RegExp('\\bAKIA[0-9A-Z]{16}\\b'),
  new RegExp('\\bgh[pousr]_[A-Za-z0-9]{30,}'),
  new RegExp('\\bsk-[A-Za-z0-9]{20,}'),
  new RegExp('\\beyJ[A-Za-z0-9_-]{10,}\\.eyJ[A-Za-z0-9_-]{10,}\\.'),
  new RegExp('(?:postgres(?:ql)?|mysql|mongodb(?:\\+srv)?)://[^\\s:@/]+:[^\\s@/]+@'),
];
const deny = (process.env.MB_DENY || '').split(',').map((s) => s.trim()).filter(Boolean).map((s) => new RegExp('\\b' + s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i'));

// 1. SKILL.md frontmatter
const skill = path.join(root, 'SKILL.md');
if (!fs.existsSync(skill)) err('SKILL.md', 0, 'missing');
else {
  const s = fs.readFileSync(skill, 'utf8');
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(s);
  if (!m) err('SKILL.md', 1, 'frontmatter missing');
  else {
    if (!/^name:\s*\S+/m.test(m[1])) err('SKILL.md', 1, 'name missing');
    const d = /^description:[ \t]*(.*)$/m.exec(m[1]);
    if (!d || !d[1] || /^[>|]/.test(d[1])) err('SKILL.md', 1, 'description must be one single-line string');
    else {
      if (d[1].replace(/^"|"$/g, '').length > 300) err('SKILL.md', 1, 'description over 300 chars');
      if (!/^".*"$/.test(d[1]) && /: /.test(d[1])) err('SKILL.md', 1, 'unquoted ": " in description');
    }
    if (/^license:/m.test(m[1]) && !fs.existsSync(path.join(root, 'LICENSE'))) err('LICENSE', 0, 'license declared but LICENSE file missing');
  }
}

for (const f of all) {
  const r = rel(f);
  if (isExempt(r)) continue;
  const base = path.basename(f);
  const selfCheck = /^verify\.cjs$|_test\.cjs$/.test(base);
  if (/\.md$/.test(f) && fs.readFileSync(f, 'utf8').split('\n').length - 1 > 200) err(r, 0, 'over 200 lines');
  if (/\.cjs$/.test(f) && fs.readFileSync(f, 'utf8').split('\n').length - 1 > 300) err(r, 0, 'over 300 lines');
  if (!TEXT.test(f)) continue;
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  lines.forEach((l, i) => {
    if (!selfCheck) {
      if (r !== 'templates/MODELS.md' && modelRe.test(l)) err(r, i + 1, 'model name outside templates/MODELS.md');
      if (pathRe.test(l)) err(r, i + 1, 'absolute local path');
      secretRes.forEach((re) => { if (re.test(l)) err(r, i + 1, 'possible secret (value not shown)'); });
    }
    deny.forEach((re) => { if (re.test(l)) err(r, i + 1, 'denied word'); });
  });
  if (/\.md$/.test(f)) {
    lines.forEach((l, i) => {
      for (const m of l.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
        const t = m[1].split('#')[0];
        if (!t || /^(?:https?:|mailto:)/.test(t)) continue;
        if (!fs.existsSync(path.resolve(path.dirname(f), t))) err(r, i + 1, `broken link ${t}`);
      }
    });
  }
  if (base === 'SKILL.md' && f !== skill) warns.push(`${r}: nested SKILL.md (may be discovered as a separate skill)`);
}

warns.forEach((w) => console.log('warn: ' + w));
if (errors.length) { console.log('verify: FAILED\n' + errors.join('\n')); process.exit(1); }
console.log(`verify: ok (${all.length} files)`);
