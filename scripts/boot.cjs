#!/usr/bin/env node
'use strict';
// boot.cjs <master_dir> [--role chief|master|worker] [--self M3]: the whole boot bookkeeping in one call, 25 lines or
// fewer, zero model tokens. In order: LAWS sync (outdated laws updated from the skill) and digest check, capacity check with leftover servers
// (capacity.cjs), the status snapshot with its improve nudge (state.cjs), then LAST blocks (rollover.cjs):
//   master: masters/<self>.md (self defaults to the only masters/M*.md)   chief: masters/C1.md and every masters/M*.md
//   worker: handoffs/<self>.md only (no snapshot: a worker reads its brief).
// Exit: 0 ok, 1 digest stale (read the full LAWS.md), 2 bad input.
const fs = require('fs');
const path = require('path');
const { digestHash, sha, sync } = require('./law-lint.cjs');
const { check } = require('./capacity.cjs');
const { snapshot } = require('./state.cjs');
const { lastBlock } = require('./rollover.cjs');

const MAX = 25;
const read = (f) => { try { return fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n'); } catch { return null; } };
const num = (f) => parseInt(f.slice(1), 10);

function lawsLine(dir) {
  const laws = path.join(dir, 'LAWS.md');
  const dig = path.join(dir, 'LAWS_DIGEST.md');
  if (!fs.existsSync(laws)) return { ok: true, line: 'laws: no LAWS.md (skill defaults apply)' };
  // Every project follows the skill's current laws: a law the human never edited is updated here, at zero model tokens.
  const sk = path.join(__dirname, '..', 'templates');
  let up = '';
  try {
    const r = sync(laws, path.join(sk, 'LAWS.md'), path.join(sk, 'laws-history.json'), { apply: true });
    const ch = r.outdated.concat(r.missing);
    if (ch.length) up = `laws: updated ${ch.join(', ')} to the skill's current text (old copy LAWS.prev.md${r.unfilled.length ? '; fill ' + r.unfilled.join(', ') : ''}): tell the human`;
    if (r.custom.length) up += (up ? '; ' : 'laws: ') + `edited by the human, not updated: ${r.custom.join(', ')} (compare with templates/LAWS.md, ask the human)`;
  } catch (e) { up = 'laws: sync skipped (' + String(e.message || e).slice(0, 80) + ')'; }
  const fresh = fs.existsSync(dig) && digestHash(dig) === sha(laws);
  if (up) return { ok: fresh, line: up + (fresh ? '' : '; digest STALE: read the full LAWS.md, then law-lint.cjs digest <LAWS> <DIGEST>') };
  if (fs.existsSync(dig) && digestHash(dig) === sha(laws)) return { ok: true, line: 'laws: digest ok (read LAWS_DIGEST.md)' };
  return { ok: false, line: 'laws: digest STALE: read the full LAWS.md, then law-lint.cjs digest <LAWS> <DIGEST>' };
}

function histories(dir, role, self) {
  const m = path.join(dir, 'masters');
  const masters = fs.existsSync(m) ? fs.readdirSync(m).filter((f) => /^M\d+\.md$/.test(f)).sort((a, b) => num(a) - num(b)) : [];
  const id = (f) => f.slice(0, -3);
  if (role === 'worker') return self ? [[self, path.join(dir, 'handoffs', self + '.md')]] : [];
  if (role === 'chief') return [['C1', path.join(m, 'C1.md')], ...masters.map((f) => [id(f), path.join(m, f)])];
  if (self) return [[self, path.join(m, self + '.md')]];
  if (masters.length === 1) return [[id(masters[0]), path.join(m, masters[0])]];
  if (masters.length) return [[null, null, `several Masters (${masters.map(id).join(', ')}): re-run with --self M#`]];
  return [];
}

function boot(dir, { role = 'master', self } = {}) {
  if (!dir || !fs.existsSync(dir)) throw new Error(`no master_dir "${dir}"`);
  if (!['chief', 'master', 'worker'].includes(role)) throw new Error(`bad role "${role}" (chief|master|worker)`);
  const laws = lawsLine(dir);
  const head = [laws.line, ...check(dir)];
  if (role !== 'worker') head.push(...snapshot(dir, role === 'chief' ? 8 : 10));
  const hs = histories(dir, role, self);
  const room = Math.max(2, MAX - head.length);
  const per = Math.max(1, Math.floor(room / Math.max(1, hs.length)) - 1);
  const body = [];
  for (const [id, file, note] of hs) {
    if (note) { body.push(note); continue; }
    const last = lastBlock(read(file), { keepDone: true, max: per });
    body.push(`LAST ${id}:${last.length ? '' : ' none'}`, ...last.map((l) => '  ' + l.trim().slice(0, 150)));
  }
  let out = head.concat(body);
  if (out.length > MAX) out = out.slice(0, MAX - 1).concat(`(cut at ${MAX} lines: read the LAST blocks in masters/ for the rest)`);
  return { ok: laws.ok, lines: out };
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const flag = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
  try {
    if (!argv[0] || argv[0].startsWith('--')) throw new Error('usage: boot.cjs <master_dir> [--role chief|master|worker] [--self M3]');
    const r = boot(argv[0], { role: flag('--role') || 'master', self: flag('--self') });
    console.log(r.lines.join('\n'));
    process.exit(r.ok ? 0 : 1);
  } catch (e) { console.error(String(e.message || e)); process.exit(2); }
}

module.exports = { boot };
