'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

const S = path.join(__dirname, 'rollover.cjs');
const run = (...a) => cp.spawnSync('node', [S, ...a], { encoding: 'utf8' });

function project() {
  const md = fs.mkdtempSync(path.join(os.tmpdir(), 'mb-roll-'));
  fs.mkdirSync(path.join(md, 'masters'));
  fs.writeFileSync(path.join(md, 'BOARD.md'), `# BOARD
## Masters
| Master | Area | Session |
|---|---|---|
| M1 | billing | local_aaa |
| M2 | admin UI | local_bbb |

## Tasks
| id | task | status |
|---|---|---|
| W-M1-1 | tenants table | done |
| W-M1-2 | stripe plans | merged |
| W-M1-3 | metering | running |
| W-M2-1 | dashboard | blocked |
`);
  fs.writeFileSync(path.join(md, 'masters', 'C1.md'), `# C1
## LAST
- Waiting on the human: plan prices
- W-M1-1 tenants table done and merged
- Next: e2e sweep after W-M1-3
`);
  return md;
}

test('handoff keeps every Master and only open tasks, and drops finished items', () => {
  const md = project();
  const r = run('handoff', md);
  assert.strictEqual(r.status, 0, r.stderr);
  const out = fs.readFileSync(path.join(md, 'masters', 'C1-next.md'), 'utf8');
  assert.match(out, /local_aaa/); assert.match(out, /local_bbb/);
  assert.match(out, /W-M1-3/); assert.match(out, /W-M2-1/);
  assert.doesNotMatch(out, /W-M1-1|W-M1-2/);
  assert.match(out, /open: 2 of 4/);
  assert.match(out, /plan prices/); assert.match(out, /e2e sweep/);
  assert.ok(out.split('\n').length <= 61);
});

test('due says roll over at the point and keep below it', () => {
  assert.strictEqual(run('due', '260000').status, 0);
  assert.match(run('due', '260000').stdout, /roll over/);
  assert.strictEqual(run('due', '120000').status, 1);
  assert.strictEqual(run('due', '120000', '--at', '100000').status, 0);
  assert.strictEqual(run('due', 'x').status, 2);
});

test('a Master handoff keeps only its own open tasks and says to resume as that Master', () => {
  const md = project();
  run('handoff', md, '--chat', 'M2');
  const out = fs.readFileSync(path.join(md, 'masters', 'M2-next.md'), 'utf8');
  assert.match(out, /W-M2-1/); assert.doesNotMatch(out, /W-M1-3/);
  assert.match(out, /local_bbb/); assert.doesNotMatch(out, /local_aaa/);
  assert.match(out, /resume.*as M2/); assert.match(out, /BOARD Masters row for M2/);
});

// A project with master-brain/ inside it, so the hook check reads <project>/.claude and never the temp folder itself.
function nested({ masters = 2, hook = false, law = '' } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mb-roll-p-'));
  const md = path.join(root, 'master-brain');
  fs.mkdirSync(path.join(md, 'masters'), { recursive: true });
  const rows = Array.from({ length: masters }, (_, i) => `| M${i + 1} | area ${i + 1} | local_${i} |`).join('\n');
  fs.writeFileSync(path.join(md, 'BOARD.md'), `# BOARD\n## Masters\n| Master | Area | Session |\n|---|---|---|\n${rows}\n`);
  fs.writeFileSync(path.join(md, 'STATE.md'), '# State\n');
  if (law) fs.writeFileSync(path.join(md, 'LAWS.md'), `12. **Context.** ... Rollover: \`${law}\` (default auto).\n`);
  if (hook) {
    fs.mkdirSync(path.join(root, '.claude'));
    fs.writeFileSync(path.join(root, '.claude', 'settings.json'), JSON.stringify({ hooks: { SessionStart: [{ matcher: 'startup|clear', hooks: [{ type: 'command', command: 'node "/s/scripts/reboot.cjs" hook' }] }] } }));
  }
  return md;
}
const r = require('./rollover.cjs');

test('cost counts steps: each old-chat step costs the context, each fresh-chat step the fresh start', () => {
  assert.deepStrictEqual(r.cost({ ctx: 250000, peers: 3, auto: true }), { newChat: 920000, inPlace: 750000 });
  assert.deepStrictEqual(r.cost({ ctx: 250000, peers: 1, auto: false }), { newChat: 680000, inPlace: 500000 });
});

test('choose picks the fewer tokens, a tie to clear in place, and new chat without the hook', () => {
  assert.strictEqual(r.choose(nested({ masters: 3, hook: true }), { ctx: 250000 }).method, 'clear in place');
  assert.strictEqual(r.choose(nested({ masters: 1, hook: true }), { ctx: 250000 }).method, 'new chat', '1 Master in auto mode: 0.68M < 0.75M');
  assert.strictEqual(r.choose(nested({ masters: 1, hook: true }), { ctx: 250000, mode: 'default' }).method, 'clear in place');
  assert.strictEqual(r.choose(nested({ masters: 1, hook: true }), { ctx: 225000, fresh: 75000, chat: 'C1' }).method, 'clear in place', 'tie at 0.675M goes to clear in place');
  const no = r.choose(nested({ masters: 5, hook: false }), { ctx: 250000 });
  assert.strictEqual(no.method, 'new chat');
  assert.match(no.line, /hook is not installed/);
  assert.strictEqual(r.choose(nested({ masters: 5, hook: true }), { ctx: 250000, chat: 'M2' }).peers, 1, 'a Master tells only the Chief');
});

test('law 12 can fix the method; auto is the default', () => {
  assert.strictEqual(r.choose(nested({ masters: 5, hook: true, law: 'new chat' }), { ctx: 250000 }).method, 'new chat');
  assert.strictEqual(r.choose(nested({ masters: 1, hook: true, law: 'clear in place' }), { ctx: 250000 }).method, 'clear in place');
  assert.strictEqual(r.choose(nested({ masters: 1, hook: false, law: 'clear in place' }), { ctx: 250000 }).method, 'new chat', 'no hook, no clear');
  assert.strictEqual(r.setting(nested()), 'auto');
});

test('handoff --mark writes the same-chat first steps and the reboot marker with this chat id', () => {
  const md = nested({ masters: 2 });
  const res = cp.spawnSync('node', [S, 'handoff', md, '--chat', 'C1', '--mark'], { encoding: 'utf8', env: { ...process.env, CLAUDE_CODE_HOST_SESSION_ID: 'local_chief' } });
  assert.strictEqual(res.status, 0);
  const text = fs.readFileSync(path.join(md, 'masters', 'C1-next.md'), 'utf8');
  assert.match(text, /same chat, cleared in place[\s\S]*tell no one a new id/);
  assert.doesNotMatch(text, /archive_session/);
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(md, 'masters', '.reboot'), 'utf8')).session, 'local_chief');
  assert.match(res.stdout, /reboot: marked .*now clear_session self/);
});

test('measure: choose stays uncalibrated until 3 fresh starts, then uses their median', () => {
  const md = nested({ masters: 3, hook: true });
  assert.match(r.choose(md, { ctx: 250000 }).line, /fresh 60k uncalibrated/);
  r.measure(md, { fresh: 90000 }); r.measure(md, { fresh: 120000, method: 'clear' });
  assert.strictEqual(r.calibrated(md), null);
  r.measure(md, { fresh: 100000 });
  assert.deepStrictEqual(r.calibrated(md), { fresh: 100000, n: 3 });
  const c = r.choose(md, { ctx: 250000 });
  assert.strictEqual(c.fresh, 100000);
  assert.match(c.line, /fresh 100k calibrated \(3\)/);
  assert.strictEqual(r.choose(md, { ctx: 250000, fresh: 50000 }).basis, 'fresh start given');
  assert.throws(() => r.measure(md, {}), /--fresh N/);
});

test('handoff: the first steps survive a long BOARD, and say to record the fresh start', () => {
  const md = nested({ masters: 1, hook: true });
  const rows = Array.from({ length: 80 }, (_, i) => `| T${i} | open | W-M1-${i} |`).join('\n');
  for (let t = 0; t < 4; t++) fs.appendFileSync(path.join(md, 'BOARD.md'), `\n## Tasks ${t}\n| Task | Status | Worker |\n|---|---|---|\n${rows}\n`);
  for (const inPlace of [false, true]) {
    const h = r.handoff(md, 'C1', { inPlace });
    assert.ok(h.trim().split('\n').length <= 60);
    assert.match(h, /## First steps/);
    assert.match(h, new RegExp(`rollover\.cjs measure <master_dir> --chat C1 --method ${inPlace ? 'clear' : 'new'}`));
  }
});
