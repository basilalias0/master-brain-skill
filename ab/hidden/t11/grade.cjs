'use strict';
// grade.cjs <workdir> [more workdirs]: hidden checks for the UI-rules A/B task (t11). Prints one JSON line per dir.
// Checks were fixed before any run. Pass = all.
//  C1 trigger #country is >= 48 px tall          C2 toggles: clickable area >= 48 px tall
//  C3 keyboard: Enter opens, ArrowDown moves the active option, Enter picks, Esc closes and focus returns
//  C4 edge: opened near the bottom of a 600 px viewport, the list stays fully on screen with 3+ options visible
//  C5 search is debounced: typing "united" (60 ms per key) sends 1-2 searches and shows only matches
//  C6 server paging: scrolling the list to the end loads more options (no full 240 load up front)
//  C7 optimistic toggle: email flips within 150 ms (server takes 1.2 s)
//  C8 rollback: marketing (server fails) returns to its old state and a message says it failed
//  C9 payment is not optimistic: within 300 ms no success text and the button blocks a second click (1 request);
//     after the 402 a failure message and still no success text
//  C10 no page errors or console errors
const path = require('path');
const cp = require('child_process');
// Playwright is not a dependency: set PLAYWRIGHT_FROM to a folder whose node_modules has it (default: this folder).
const PW = require(require.resolve('playwright', { paths: [process.env.PLAYWRIGHT_FROM || process.cwd(), __dirname] }));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const OK = /\b(paid|success|successful|thank|complete|completed|confirmed)\b/i;
const BAD = /declin|fail|error|could not|couldn.t|try again|not saved|unable/i;

async function grade(dir, port) {
  const srv = cp.spawn('node', ['server.js'], { cwd: dir, env: { ...process.env, PORT: String(port), FAIL_SETTINGS: 'marketing', PAY_FAIL: '1' }, stdio: 'ignore' });
  await sleep(700);
  const browser = await PW.chromium.launch({ channel: 'chrome' }).catch(() => PW.chromium.launch({ channel: 'msedge' }));
  const C = {}; const notes = [];
  const errors = [];
  const fresh = async (vp = { width: 1000, height: 800 }) => {
    const page = await browser.newPage({ viewport: vp }); page.setDefaultTimeout(4000);
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
    const reqs = []; page.on('request', (r) => reqs.push({ url: r.url(), method: r.method(), t: Date.now() }));
    await page.goto(`http://localhost:${port}/`, { waitUntil: 'networkidle' });
    await sleep(300);
    return { page, reqs };
  };
  const visibleOptions = (page) => page.evaluate(() => [...document.querySelectorAll('[data-value]:not(#country)')].filter((e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden'; }).map((e) => e.textContent.trim()));
  const run = async (name, fn) => { try { C[name] = !!(await fn()); } catch (e) { C[name] = false; notes.push(`${name}: ${String(e.message || e).split('\n')[0].slice(0, 120)}`); } };
  const open = async (page, how = 'click') => {
    if (how === 'key') { await page.focus('#country'); await page.keyboard.press('Enter'); } else await page.click('#country');
    for (let i = 0; i < 20 && !(await visibleOptions(page)).length; i++) await sleep(100);
    return (await visibleOptions(page)).length;
  };

  try {
    await run('C1', async () => { const { page } = await fresh(); const b = await page.locator('#country').boundingBox(); await page.close(); notes.push(`C1 height ${b && Math.round(b.height)}`); return b && b.height >= 47.5; });
    await run('C2', async () => {
      const { page } = await fresh();
      const hs = await page.evaluate(() => [...document.querySelectorAll('[data-setting]')].map((e) => {
        const rs = [e, e.closest('label'), e.id && document.querySelector(`label[for="${e.id}"]`)].filter(Boolean).map((x) => x.getBoundingClientRect().height);
        return Math.max(...rs);
      }));
      await page.close(); notes.push(`C2 heights ${hs.map(Math.round).join(',')}`);
      return hs.length === 3 && hs.every((h) => h >= 47.5);
    });
    await run('C3', async () => {
      const { page } = await fresh();
      const before = await page.locator('#country').innerText().catch(() => '');
      if (!(await open(page, 'key'))) throw new Error('Enter did not open');
      const sig = () => page.evaluate(() => { const a = document.activeElement; return [a && a.getAttribute('aria-activedescendant'), a && a.dataset && a.dataset.value, [...document.querySelectorAll('[data-value][aria-selected="true"],[data-value].active,[data-value][data-active="true"]')].map((e) => e.dataset.value).join()].join('|'); });
      const s0 = await sig(); await page.keyboard.press('ArrowDown'); await sleep(80); await page.keyboard.press('ArrowDown'); await sleep(80);
      const s1 = await sig(); if (s0 === s1 || !s1.replace(/\|/g, '')) throw new Error('ArrowDown did not move an active option');
      await page.keyboard.press('Enter'); await sleep(400);
      const after = await page.locator('#country').innerText().catch(() => '');
      const value = await page.evaluate(() => { const c = document.querySelector('#country'); return (c.value || '') + (c.querySelector('input') ? c.querySelector('input').value : ''); });
      if ((await visibleOptions(page)).length) throw new Error('Enter did not close');
      if (after === before && !value) throw new Error('Enter did not pick');
      await page.focus('#country'); await page.keyboard.press('ArrowDown'); for (let i = 0; i < 20 && !(await visibleOptions(page)).length; i++) await sleep(100);
      if (!(await visibleOptions(page)).length) throw new Error('ArrowDown did not reopen');
      await page.keyboard.press('Escape'); await sleep(400);
      const closed = !(await visibleOptions(page)).length;
      const focus = await page.evaluate(() => { const c = document.querySelector('#country'); const a = document.activeElement; return a === c || c.contains(a); });
      await page.close(); if (!closed) throw new Error('Esc did not close'); if (!focus) throw new Error('focus not returned'); return true;
    });
    await run('C4', async () => {
      const { page } = await fresh({ width: 1000, height: 600 });
      await page.evaluate(() => { document.body.style.paddingBottom = '2000px'; const r = document.querySelector('#country').getBoundingClientRect(); window.scrollTo(0, window.scrollY + r.top - 520); });
      await sleep(200); await open(page); await sleep(500);
      const r = await page.evaluate(() => {
        const opts = [...document.querySelectorAll('[data-value]:not(#country)')].filter((e) => e.getBoundingClientRect().height > 0);
        let box = opts[0]; while (box && box.parentElement && !(box.parentElement.contains(opts[opts.length - 1]) && box.parentElement !== opts[0].parentElement.parentElement)) box = box.parentElement;
        box = opts[0].closest('[role="listbox"]') || opts[0].parentElement;
        const b = box.getBoundingClientRect();
        const inView = opts.filter((e) => { const x = e.getBoundingClientRect(); return x.top >= -1 && x.bottom <= innerHeight + 1; }).length;
        return { top: b.top, bottom: b.bottom, inView, h: innerHeight };
      });
      await page.close(); notes.push(`C4 list ${Math.round(r.top)}-${Math.round(r.bottom)} of ${r.h}, ${r.inView} in view`);
      return r.top >= -1 && r.bottom <= r.h + 1 && r.inView >= 3;
    });
    await run('C5', async () => {
      const { page, reqs } = await fresh();
      await open(page);
      const typed = await page.evaluate(() => { const a = document.activeElement; if (a && a.tagName === 'INPUT' && a.type !== 'checkbox') return true; const i = [...document.querySelectorAll('input')].find((x) => x.type !== 'checkbox' && x.type !== 'radio' && x.getBoundingClientRect().height > 0); if (i) { i.focus(); return true; } return false; });
      if (!typed) throw new Error('no search input');
      const t0 = Date.now(); await page.keyboard.type('united', { delay: 60 }); await sleep(1200);
      const n = reqs.filter((r) => r.t >= t0 && /\/api\/countries/.test(r.url) && /[?&]q=[^&]/.test(r.url)).length;
      const opts = await visibleOptions(page); await page.close();
      notes.push(`C5 ${n} search requests, ${opts.length} shown`);
      return n >= 1 && n <= 2 && opts.length > 0 && opts.every((o) => /united/i.test(o));
    });
    await run('C6', async () => {
      const { page, reqs } = await fresh();
      await open(page); await sleep(800);
      const n1 = (await visibleOptions(page)).length + await page.evaluate(() => document.querySelectorAll('[data-value]:not(#country)').length) * 0;
      const all1 = await page.evaluate(() => document.querySelectorAll('[data-value]:not(#country)').length);
      for (let k = 0; k < 2; k++) {
        await page.evaluate(() => { const o = document.querySelector('[data-value]:not(#country)'); let s = o.parentElement; while (s && !(s.scrollHeight > s.clientHeight + 2 && /auto|scroll/.test(getComputedStyle(s).overflowY))) s = s.parentElement; if (s) { s.scrollTop = s.scrollHeight; s.dispatchEvent(new Event('scroll')); } const last = [...document.querySelectorAll('[data-value]:not(#country)')].pop(); last.scrollIntoView({ block: 'end' }); });
        await sleep(1200);
      }
      const all2 = await page.evaluate(() => document.querySelectorAll('[data-value]:not(#country)').length);
      const paged = reqs.some((r) => /\/api\/countries/.test(r.url) && /[?&]page=([2-9]|\d\d)/.test(r.url));
      await page.close(); notes.push(`C6 options ${all1} -> ${all2}, page>=2 requested ${paged}, visible at open ${n1}`);
      return all1 > 0 && all1 < 240 && all2 > all1 && paged;
    });
    const state = (page, k) => page.evaluate((k) => { const e = document.querySelector(`[data-setting="${k}"]`); const a = e.getAttribute('aria-checked'); return a != null ? a === 'true' : !!e.checked; }, k);
    const click = async (page, k) => { const l = page.locator(`[data-setting="${k}"]`); try { await l.click({ timeout: 800 }); } catch { await page.evaluate((k) => { const e = document.querySelector(`[data-setting="${k}"]`); (e.closest('label') || e).click(); }, k); } };
    await run('C7', async () => {
      const { page } = await fresh(); await sleep(400);
      const s0 = await state(page, 'email'); const t = Date.now(); await click(page, 'email');
      await sleep(Math.max(0, 150 - (Date.now() - t))); const s1 = await state(page, 'email');
      await sleep(1600); const s2 = await state(page, 'email'); await page.close();
      notes.push(`C7 ${s0} -> ${s1} at 150 ms -> ${s2}`);
      return s1 !== s0 && s2 !== s0;
    });
    await run('C8', async () => {
      const { page } = await fresh(); await sleep(400);
      const text0 = await page.evaluate(() => document.body.innerText);
      const s0 = await state(page, 'marketing'); await click(page, 'marketing'); await sleep(2200);
      const s2 = await state(page, 'marketing'); const text = await page.evaluate(() => document.body.innerText);
      const msg = BAD.test(text.replace(text0, '')) || (BAD.test(text) && !BAD.test(text0));
      await page.close(); notes.push(`C8 back to old state ${s2 === s0}, message ${msg}`);
      return s2 === s0 && msg;
    });
    await run('C9', async () => {
      const { page, reqs } = await fresh(); await sleep(300);
      const t0 = Date.now(); await page.click('#pay'); await sleep(100); await page.click('#pay', { force: true, timeout: 500 }).catch(() => {});
      await sleep(Math.max(0, 300 - (Date.now() - t0)));
      const early = await page.evaluate(() => { const p = document.querySelector('#pay'); const s = document.querySelector('#pay-status'); return { blocked: p.disabled || p.getAttribute('aria-disabled') === 'true' || p.getAttribute('aria-busy') === 'true', status: s ? s.innerText : '' }; });
      await sleep(2600);
      const late = await page.evaluate(() => (document.querySelector('#pay-status') || {}).innerText || '');
      const n = reqs.filter((r) => /\/api\/pay/.test(r.url) && r.method === 'POST').length; await page.close();
      notes.push(`C9 early "${early.status.slice(0, 40)}" blocked ${early.blocked}, requests ${n}, late "${late.slice(0, 50)}"`);
      return !OK.test(early.status) && n === 1 && BAD.test(late) && !OK.test(late);
    });
    C.C10 = errors.length === 0; if (errors.length) notes.push('C10 ' + errors.slice(0, 2).join(' / ').slice(0, 160));
  } finally { await browser.close(); srv.kill(); }
  const pass = Object.values(C).every(Boolean);
  return { dir: path.basename(dir), pass, checks: C, passed: Object.values(C).filter(Boolean).length, notes };
}

(async () => {
  let port = 4400;
  for (const d of process.argv.slice(2)) console.log(JSON.stringify(await grade(path.resolve(d), port++)));
})();
