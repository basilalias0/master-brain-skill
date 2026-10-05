#!/usr/bin/env node
'use strict';
// overlay.cjs <cmd> --dir MASTER_DIR [--skill SKILL_ROOT]
//   add <module> --rule TEXT --evidence TEXT [--scope project|general]
//   list [module] | retire <id> | check | rebase | export --out FILE
// Project-only rules live in <MASTER_DIR>/overlay/<module>.md. The installed skill is never edited.
// An overlay rule may add or tighten behavior; it may never relax safety, tests, locks, approvals or floors.
const fs = require('fs');
const path = require('path');

const CAP = 1500; // chars of active rule text per module
const WEAKEN = [
  /\b(?:skip|ignore|disable|delete|remove|loosen|bypass|weaken|turn off|drop)\b[^.\n]{0,40}\b(?:tests?|locks?|safety|approvals?|floors?|guard|security|audit|review)\b/i,
  /\b(?:tests?|locks?|safety|approvals?|floors?|guard|security|audit)\b[^.\n]{0,40}\b(?:optional|not needed|can be skipped|may be skipped|not required)\b/i,
  /\b(?:without|no)\s+(?:asking|approval|confirmation|the user'?s? (?:yes|approval))\b/i,
  /\b(?:auto-?approve|force[- ]push|push without|never ask)\b/i,
];
const SECRET = [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, /\bAKIA[0-9A-Z]{16}\b/, /\bgh[pousr]_[A-Za-z0-9]{30,}/, /\bsk-[A-Za-z0-9]{20,}/, /:\/\/[^\s:@/]+:[^\s@/]+@/];
const PATHISH = /(?<![A-Za-z])[A-Za-z]:[\\/]|\/(?:Users|home)\/[\w.-]+|\\Users\\/;

const today = () => new Date().toISOString().slice(0, 10);
const words = (s) => new Set((s.toLowerCase().match(/[a-z]{5,}/g) || []));
const jaccard = (a, b) => { const i = [...a].filter((x) => b.has(x)).length; return i / (a.size + b.size - i || 1); };

function modules(skill) {
  const d = path.join(skill, 'modules');
  return fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name) : [];
}

function parse(file) {
  if (!fs.existsSync(file)) return [];
  const out = [];
  let cur = null;
  for (const l of fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n').split('\n')) {
    const h = /^## (ov-\d+) \[(active|retired)\]/.exec(l);
    if (h) { cur = { id: h[1], status: h[2] }; out.push(cur); continue; }
    const f = cur && /^(rule|evidence|scope|added): ?(.*)$/.exec(l);
    if (f) cur[f[1]] = f[2];
  }
  return out;
}

function write(file, mod, entries) {
  const body = entries.map((e) => `## ${e.id} [${e.status}]\nrule: ${e.rule}\nevidence: ${e.evidence}\nscope: ${e.scope}\nadded: ${e.added}\n`).join('\n');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `# overlay: ${mod}\n\n${body}`);
}

function all(dir) {
  const od = path.join(dir, 'overlay');
  if (!fs.existsSync(od)) return [];
  return fs.readdirSync(od).filter((f) => f.endsWith('.md')).flatMap((f) => {
    const mod = f.replace(/\.md$/, '');
    return parse(path.join(od, f)).map((e) => ({ ...e, module: mod }));
  });
}

function nextId(dir) {
  return 'ov-' + (all(dir).reduce((m, e) => Math.max(m, Number(e.id.slice(3))), 0) + 1);
}

function add(dir, skill, mod, rule, evidence, scope = 'project') {
  if (!modules(skill).includes(mod)) throw new Error(`unknown module "${mod}" (have: ${modules(skill).join(', ')})`);
  if (!rule || !evidence) throw new Error('rule and evidence are both required');
  if (!['project', 'general'].includes(scope)) throw new Error('scope must be project or general');
  if (/[\r\n]/.test(rule + evidence)) throw new Error('rule and evidence must be one line each');
  const text = rule + ' ' + evidence;
  if (WEAKEN.some((re) => re.test(text))) throw new Error('rejected: an overlay rule may not relax safety, tests, locks, approvals or floors');
  if (SECRET.some((re) => re.test(text))) throw new Error('rejected: looks like a secret');
  const file = path.join(dir, 'overlay', mod + '.md');
  const entries = parse(file);
  const used = entries.filter((e) => e.status === 'active').reduce((n, e) => n + e.rule.length, 0);
  if (used + rule.length > CAP) throw new Error(`rejected: ${mod} overlay would be ${used + rule.length} chars, cap ${CAP}. Retire or merge a rule first`);
  const e = { id: nextId(dir), status: 'active', rule, evidence, scope, added: today() };
  entries.push(e);
  write(file, mod, entries);
  return e;
}

function retire(dir, id) {
  for (const e of all(dir)) {
    if (e.id !== id) continue;
    const file = path.join(dir, 'overlay', e.module + '.md');
    const entries = parse(file);
    entries.find((x) => x.id === id).status = 'retired';
    write(file, e.module, entries);
    return e;
  }
  throw new Error(`no rule ${id}`);
}

const readVersion = (skill) => (fs.existsSync(path.join(skill, 'VERSION')) ? fs.readFileSync(path.join(skill, 'VERSION'), 'utf8').trim() : 'unknown');

// check: what changed upstream since base.json, and which approved local rules overlap the new text.
function check(dir, skill) {
  const bf = path.join(dir, 'overlay', 'base.json');
  const base = fs.existsSync(bf) ? JSON.parse(fs.readFileSync(bf, 'utf8')).version : null;
  const now = readVersion(skill);
  const lines = [`base ${base || 'none'} -> installed ${now}`];
  const log = fs.existsSync(path.join(skill, 'CHANGELOG.md')) ? fs.readFileSync(path.join(skill, 'CHANGELOG.md'), 'utf8') : '';
  for (const e of all(dir).filter((x) => x.status === 'active')) {
    const modFile = path.join(skill, 'modules', e.module, 'MODULE.md');
    const upstream = (fs.existsSync(modFile) ? fs.readFileSync(modFile, 'utf8') : '') + '\n' + log;
    const sim = jaccard(words(e.rule), words(upstream));
    const rec = sim >= 0.5 ? 'adopt (upstream already covers it; retire yours)' : sim >= 0.25 ? 'both (partial overlap; keep yours until upstream is verified on your tasks)' : 'keep (no upstream overlap)';
    lines.push(`${e.id} [${e.module}, ${e.scope}] overlap ${sim.toFixed(2)}: ${rec}`);
  }
  if (lines.length === 1) lines.push('no overlay rules');
  return lines;
}

function rebase(dir, skill) {
  fs.mkdirSync(path.join(dir, 'overlay'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'overlay', 'base.json'), JSON.stringify({ version: readVersion(skill), updated: today() }) + '\n');
}

// export: general-scope active rules, rule text and counts only. No evidence text, no paths, no logs.
function exportRules(dir) {
  const rules = all(dir).filter((e) => e.status === 'active' && e.scope === 'general');
  for (const r of rules) {
    if (SECRET.some((re) => re.test(r.rule)) || PATHISH.test(r.rule)) throw new Error(`${r.id}: contains a secret or a local path; edit it first`);
  }
  return { generated: today(), rules: rules.map((r) => ({ module: r.module, rule: r.rule, evidence_note: r.evidence ? 'present' : 'missing' })) };
}

function main(argv) {
  const flag = (n) => { const i = argv.indexOf(n); return i > -1 ? argv[i + 1] : undefined; };
  const dir = path.resolve(flag('--dir') || 'master-brain');
  const skill = path.resolve(flag('--skill') || path.join(__dirname, '..'));
  const [cmd, a] = argv;
  try {
    if (cmd === 'add') { const e = add(dir, skill, a, flag('--rule'), flag('--evidence'), flag('--scope')); console.log(`added ${e.id} to ${a}`); }
    else if (cmd === 'list') {
      const es = all(dir).filter((e) => !a || a.startsWith('--') || e.module === a);
      es.forEach((e) => console.log(`${e.id} [${e.module}, ${e.status}, ${e.scope}] ${e.rule}`));
      if (!es.length) console.log('no overlay rules');
    } else if (cmd === 'retire') { retire(dir, a); console.log(`retired ${a}`); }
    else if (cmd === 'check') console.log(check(dir, skill).join('\n'));
    else if (cmd === 'rebase') { rebase(dir, skill); console.log('base.json updated'); }
    else if (cmd === 'export') {
      const out = flag('--out');
      if (!out) throw new Error('--out FILE required');
      const x = exportRules(dir);
      fs.writeFileSync(out, JSON.stringify(x, null, 1));
      console.log(`exported ${x.rules.length} rules to ${out}. Review it, then send it yourself.`);
    } else { console.error('usage: overlay.cjs add|list|retire|check|rebase|export --dir DIR'); process.exit(2); }
  } catch (e) { console.error('overlay: ' + e.message); process.exit(1); }
}

if (require.main === module) main(process.argv.slice(2));
module.exports = { add, retire, parse, all, check, rebase, exportRules, CAP, WEAKEN };
