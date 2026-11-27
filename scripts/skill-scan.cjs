#!/usr/bin/env node
'use strict';
// skill-scan.cjs <skill dir> [--json] [--clean OUT]   Threat and size scan of a third-party skill, run on every
// download, update or local change (install-skill.cjs calls it). Exit 0 clean, 4 high findings, 2 usage.
// high = blocks the install (secret reading, exfiltration, obfuscation, auto-run hooks, prompt injection, hidden
// characters, executables); medium = shown to the human (network, subprocess, deletes); low = info.
// --clean OUT: copy without the high findings (flagged code files dropped, flagged text lines and hidden characters
// removed, lifecycle scripts and hooks deleted), then rescan the copy. The copy is for local use only.
const fs = require('fs');
const path = require('path');

const CODE = /\.(?:[cm]?[jt]sx?|py|sh|bash|zsh|ps1|psm1|bat|cmd|rb|pl|php|go|rs|lua)$/i;
const TEXT = /\.(?:md|txt|ya?ml|json|toml|html?|css|svg|csv|xml)$/i;
const EXEC = /\.(?:exe|dll|so|dylib|node|wasm|bin|msi|scr|jar|class|pyc|apk|app|deb|rpm)$/i;
const ARCHIVE = /\.(?:zip|tar|gz|tgz|7z|rar|xz|bz2)$/i;
const MAGIC = { png: [0x89, 0x50, 0x4e, 0x47], jpg: [0xff, 0xd8, 0xff], jpeg: [0xff, 0xd8, 0xff], gif: [0x47, 0x49, 0x46], webp: [0x52, 0x49, 0x46, 0x46], pdf: [0x25, 0x50, 0x44, 0x46], woff2: [0x77, 0x4f, 0x46, 0x32], woff: [0x77, 0x4f, 0x46, 0x46], ico: [0, 0, 1, 0], avif: null, mp4: null };
const HIDDEN = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]|\uDB40[\uDC00-\uDC7F]/g;

// [severity, label, pattern] per kind of file. Lines are tested one by one.
const CODE_RULES = [
  ['high', 'reads secret files', /\.ssh\b|id_rsa|id_ed25519|\.aws[\\/]credentials|\.npmrc|\.netrc|\.pgpass|\.docker[\\/]config|\.kube[\\/]config|keychain|Login Data|Cookies\.sqlite|wallet\.dat/i],
  ['high', 'dumps the whole environment', /(?:JSON\.stringify|Object\.(?:entries|keys|values))\s*\(\s*process\.env\s*\)|\bdict\s*\(\s*os\.environ\s*\)|\bprintenv\b|Get-ChildItem\s+env:/i],
  ['high', 'reads .env files', /['"`][^'"`]*\.env(?:\.[\w-]+)?['"`]/],
  ['high', 'runs decoded or built code', /\beval\s*\(|new\s+Function\s*\(|\bexec\s*\(\s*(?:base64|codecs|zlib|bytes\.fromhex|compile)|-enc(?:odedcommand)?\s+[A-Za-z0-9+/=]{20,}|FromBase64String/i],
  ['high', 'pipes a download into a shell', /(?:curl|wget|iwr|Invoke-WebRequest|irm)\b[^\n|]*\|\s*(?:sh|bash|zsh|iex|Invoke-Expression|python|node)\b/i],
  ['high', 'writes Claude settings, hooks or other skills', /\.claude[\\/](?:settings|hooks|skills|agents|commands)|settings(?:\.local)?\.json|CLAUDE\.md/i],
  ['high', 'adds start-up persistence', /\.bashrc|\.zshrc|\.profile\b|crontab|schtasks|LaunchAgents|CurrentVersion\\Run|Start Menu\\Programs\\Startup|systemctl\s+enable/i],
  ['medium', 'network call', /\bfetch\s*\(|https?\.(?:get|request)\s*\(|XMLHttpRequest|WebSocket\s*\(|net\.connect|\brequests\.(?:get|post|put)|urllib|axios|got\s*\(|socket\.socket|Invoke-WebRequest|\bcurl\b|\bwget\b/i],
  ['medium', 'starts processes', /child_process|(?<![.\w])(?:spawn|spawnSync|exec|execSync|execFile|execFileSync|fork)\s*\(|subprocess|os\.system|Start-Process/],
  ['medium', 'deletes files', /\brm\s+-[rf]{1,2}\b|rmSync\s*\([^)]*recursive|shutil\.rmtree|Remove-Item[^\n]*-Recurse|\bunlink(?:Sync)?\s*\(/i],
  ['medium', 'reads a secret environment variable', /(?:process\.env\.|os\.environ\.get\(\s*['"]|os\.environ\[\s*['"]|getenv\(\s*['"]|\$env:)\w*(?:TOKEN|KEY|SECRET|PASS|AUTH|CRED|SESSION|COOKIE)/i],
  ['low', 'reads environment variables', /process\.env\.|os\.environ|getenv\s*\(|\$env:/],
];
const TEXT_RULES = [
  ['high', 'prompt injection', /ignore (?:all |any )?(?:the )?(?:previous|prior|above|earlier|system) (?:instructions|rules|prompts?)|disregard (?:the |all )?(?:previous|prior|system)|you are now (?:in )?(?:developer|admin|jailbreak|DAN)|new system prompt|override (?:the )?(?:system|safety)/i],
  ['high', 'hides actions from the user', /(?:do not|don't|never) (?:tell|inform|notify|alert|warn) the (?:user|human)|(?:hide|conceal) (?:it|this|them) from the (?:user|human)|without (?:asking|telling|informing|notifying) the (?:user|human)|silently (?:send|upload|post|run|install|delete)/i],
  ['high', 'weakens safety or permissions', /dangerously-?skip-?permissions|bypassPermissions|--no-verify|disable (?:the )?(?:sandbox|safety|permission|hooks?)|auto-?approve (?:all|every)|approve (?:the )?permission prompts?/i],
  ['high', 'asks to send secrets out', /\b(?:send|upload|post|paste|exfiltrate|forward|transmit)\s+(?:the |all |any |every |their |your |its |the user'?s )?(?:api[ _-]?keys?|access tokens?|tokens?|passwords?|credentials?|secrets?|\.env(?: files?)?|cookies?|ssh keys?|environment variables)\b|(?:api[ _-]?keys?|tokens?|passwords?|credentials?|secrets?|cookies?)\b[^\n]{0,40}\bto (?:https?:|the (?:url|endpoint|webhook|server))/i],
  ['high', 'pipes a download into a shell', /(?:curl|wget|iwr|Invoke-WebRequest|irm)\b[^\n|]*\|\s*(?:sh|bash|zsh|iex|Invoke-Expression|python|node)\b/i],
  ['medium', 'edits Claude settings or other skills', /(?:edit|modify|write|append|change|add)[^\n]{0,40}(?:\.claude[\\/](?:settings|hooks|skills)|settings(?:\.local)?\.json|CLAUDE\.md|other skills)/i],
  ['medium', 'reads credentials', /(?:read|open|cat|print|copy|collect)\b[^\n]{0,40}\b(?:\.env\b|\.ssh|credentials? files?|keychain|cookies?|browser history|saved passwords)/i],
  ['low', 'remote script in a page', /<script[^>]+src=["']https?:\/\//i],
];
const BASE64 = /[A-Za-z0-9+/]{240,}={0,2}/;

function walk(d, out = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name === '.git' || e.name === 'node_modules') continue;
    const p = path.join(d, e.name);
    if (e.isSymbolicLink()) out.push({ p, link: true });
    else if (e.isDirectory()) walk(p, out); else out.push({ p });
  }
  return out;
}

function scan(root) {
  const findings = [];
  const add = (severity, file, line, what, text = '') => findings.push({ severity, file, line, what, text: String(text).trim().slice(0, 120) });
  const files = walk(root);
  const sizes = [];
  for (const { p, link } of files) {
    const rel = path.relative(root, p).replace(/\\/g, '/');
    if (link) { add('high', rel, 0, 'symlink (may point outside the skill)'); continue; }
    const buf = fs.readFileSync(p);
    sizes.push({ rel, bytes: buf.length });
    const ext = path.extname(p).slice(1).toLowerCase();
    if (EXEC.test(p)) { add('high', rel, 0, 'executable or compiled binary'); continue; }
    if (ARCHIVE.test(p)) { add('medium', rel, 0, 'archive: contents not scanned'); continue; }
    if (ext in MAGIC) {
      const m = MAGIC[ext];
      if (m && !m.every((b, i) => buf[i] === b)) add('high', rel, 0, `file content is not a .${ext}`);
      continue;
    }
    const s = buf.toString('utf8');
    if (s.includes('\u0000')) { add('high', rel, 0, 'unknown binary file'); continue; }
    const hidden = s.match(HIDDEN);
    if (hidden) add('high', rel, 0, `hidden characters (${hidden.length}): zero-width, bidi or tag`);
    const isCode = CODE.test(p);
    const rules = isCode ? CODE_RULES : TEXT_RULES;
    const lines = s.split(/\r?\n/);
    lines.forEach((l, i) => {
      for (const [sev, what, re] of rules) if (re.test(l)) add(sev, rel, i + 1, what, l);
      if (BASE64.test(l) && !/data:[\w/+.-]+;base64,/.test(l)) add(isCode ? 'high' : 'medium', rel, i + 1, 'long encoded blob', l.slice(0, 60));
    });
    if (/\.(?:md|html?)$/i.test(p)) for (const m of s.matchAll(/<!--([\s\S]*?)-->/g)) {
      const body = m[1].trim();
      if (body.split(/\s+/).length > 4) add('medium', rel, s.slice(0, m.index).split('\n').length, 'hidden comment text (not shown when rendered)', body);
    }
    if (/(?:^|[\\/])package\.json$/.test(p)) {
      try {
        const sc = JSON.parse(s).scripts || {};
        for (const k of ['preinstall', 'install', 'postinstall', 'prepare', 'prepublish']) if (sc[k]) add('high', rel, 0, `runs on npm install (${k})`, sc[k]);
      } catch { add('medium', rel, 0, 'package.json does not parse'); }
    }
    if (/(?:^|[\\/])(?:plugin|hooks|settings(?:\.local)?)\.json$/.test(p) && /"hooks"\s*:/.test(s)) add('high', rel, 0, 'hooks that run automatically');
    if (/(?:^|[\\/])(?:plugin|\.mcp|mcp)\.json$/.test(p) && /"mcpServers"\s*:/.test(s)) add('medium', rel, 0, 'starts an MCP server');
  }
  // A network call next to a secret or environment read in the same file is exfiltration.
  const byFile = {};
  for (const f of findings) (byFile[f.file] = byFile[f.file] || new Set()).add(f.what);
  for (const [file, w] of Object.entries(byFile)) {
    if (w.has('network call') && (w.has('reads secret files') || w.has('dumps the whole environment') || w.has('reads .env files') || w.has('reads a secret environment variable'))) {
      add('high', file, 0, 'network call in a file that also reads secrets or the environment: possible exfiltration');
    }
  }
  return { findings, optimize: optimize(root, sizes) };
}

function optimize(root, sizes) {
  const notes = [];
  const skill = path.join(root, 'SKILL.md');
  const total = sizes.reduce((n, x) => n + x.bytes, 0);
  const out = { files: sizes.length, totalKB: +(total / 1024).toFixed(1), notes };
  if (!fs.existsSync(skill)) { notes.push('no SKILL.md'); return out; }
  const s = fs.readFileSync(skill, 'utf8');
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(s);
  const dm = fm ? /^description:[ \t]*(.*)$((?:\r?\n[ \t]+.*)*)/m.exec(fm[1]) : null;
  const desc = !dm ? '' : /^[>|][+-]?$/.test(dm[1].trim()) ? dm[2].split(/\r?\n/).map((l) => l.trim()).filter(Boolean).join(' ') : dm[1].replace(/^"|"$/g, '');
  out.skillChars = s.length;
  out.skillTokens = Math.round(s.length / 4);
  out.descriptionChars = desc.length;
  if (desc.length > 1024) notes.push(`description ${desc.length} chars: over 1024, may be cut`);
  else if (desc.length > 500) notes.push(`description ${desc.length} chars: it is loaded in every session; under 500 is cheaper`);
  const lines = s.split('\n').length;
  if (lines > 500) notes.push(`SKILL.md ${lines} lines: move detail to references/`);
  if (out.skillTokens > 5000) notes.push(`SKILL.md ~${out.skillTokens} tokens on every use: load only the parts a task needs`);
  for (const x of sizes) if (x.bytes > 200 * 1024) notes.push(`${x.rel} ${(x.bytes / 1024).toFixed(0)} KB: large; read only when needed`);
  // A reference counts as reached when any markdown file in the skill names it (a link or a plain mention).
  const allMd = sizes.filter((x) => /\.md$/.test(x.rel)).map((x) => fs.readFileSync(path.join(root, x.rel), 'utf8')).join('\n');
  for (const x of sizes) {
    if (!/\.md$/.test(x.rel) || x.rel === 'SKILL.md') continue;
    const own = fs.readFileSync(path.join(root, x.rel), 'utf8');
    if (!allMd.replace(own, '').includes(path.basename(x.rel))) notes.push(`${x.rel}: not named in any other file of the skill (may be dead)`);
  }
  return out;
}

// Local copy without the high findings. Returns the rescan of the copy.
function clean(root, dest) {
  const { findings } = scan(root);
  const high = findings.filter((f) => f.severity === 'high');
  const dropFile = new Set(high.filter((f) => f.line === 0 && !/hidden characters|hooks|npm install/.test(f.what)).map((f) => f.file));
  for (const f of high) if (f.line > 0 && CODE.test(f.file)) dropFile.add(f.file);
  const dropLine = {};
  for (const f of high) if (f.line > 0 && !dropFile.has(f.file)) (dropLine[f.file] = dropLine[f.file] || new Set()).add(f.line);
  fs.rmSync(dest, { recursive: true, force: true });
  const removed = [];
  for (const { p, link } of walk(root)) {
    const rel = path.relative(root, p).replace(/\\/g, '/');
    if (link || dropFile.has(rel)) { removed.push(rel + ' (file)'); continue; }
    const to = path.join(dest, rel);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    if (!TEXT.test(p) && !CODE.test(p)) { fs.copyFileSync(p, to); continue; }
    let s = fs.readFileSync(p, 'utf8').replace(HIDDEN, '');
    if (dropLine[rel]) { s = s.split('\n').filter((_, i) => !dropLine[rel].has(i + 1)).join('\n'); removed.push(`${rel}: ${dropLine[rel].size} line(s)`); }
    if (/package\.json$/.test(rel)) { try { const j = JSON.parse(s); for (const k of ['preinstall', 'install', 'postinstall', 'prepare', 'prepublish']) if (j.scripts) delete j.scripts[k]; s = JSON.stringify(j, null, 2); } catch { /* kept as is; rescan reports it */ } }
    if (/(?:plugin|hooks|settings(?:\.local)?)\.json$/.test(rel)) { try { const j = JSON.parse(s); if (j.hooks) { delete j.hooks; removed.push(rel + ': hooks'); } s = JSON.stringify(j, null, 2); } catch { /* idem */ } }
    fs.writeFileSync(to, s);
  }
  return { removed, rescan: scan(dest) };
}

const high = (r) => r.findings.filter((f) => f.severity === 'high');

function report(r) {
  const order = { high: 0, medium: 1, low: 2 };
  const lines = r.findings.sort((a, b) => order[a.severity] - order[b.severity]).map((f) => `${f.severity.padEnd(6)} ${f.file}${f.line ? ':' + f.line : ''}  ${f.what}${f.text ? '  | ' + f.text : ''}`);
  const o = r.optimize;
  const n = (s) => r.findings.filter((f) => f.severity === s).length;
  return [`scan: ${n('high')} high, ${n('medium')} medium, ${n('low')} low`, ...lines,
    `size: ${o.files} files, ${o.totalKB} KB; SKILL.md ~${o.skillTokens || 0} tokens; description ${o.descriptionChars || 0} chars`,
    ...o.notes.map((x) => 'optimize: ' + x)].join('\n');
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const dir = argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--clean');
  if (!dir || !fs.existsSync(dir)) { console.error('usage: skill-scan.cjs <skill dir> [--json] [--clean OUT]'); process.exit(2); }
  const ci = argv.indexOf('--clean');
  if (ci >= 0) {
    const out = argv[ci + 1];
    if (!out) { console.error('--clean OUT required'); process.exit(2); }
    const c = clean(dir, out);
    console.log('removed: ' + (c.removed.join(', ') || 'nothing') + '\n' + report(c.rescan));
    process.exit(high(c.rescan).length ? 4 : 0);
  }
  const r = scan(dir);
  console.log(argv.includes('--json') ? JSON.stringify(r, null, 1) : report(r));
  process.exit(high(r).length ? 4 : 0);
}

module.exports = { scan, clean, report, high };
