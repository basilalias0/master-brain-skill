#!/usr/bin/env node
'use strict';
// page-check.cjs: check a page with a script instead of a model looking at screenshots (owner, 2026-11-18).
//   page-check.cjs <url> [--wait-for SEL] [--text "must appear"]... [--element SEL] [--baseline FILE.png [--update]]
//                  [--max-diff 0.001] [--out DIR] [--timeout SEC] [--width 1280 --height 800]
// 1. Waits until the page is really ready: network quiet, fonts loaded, --wait-for visible, animations and the caret off.
// 2. Checks each --text in the page (or --element) and counts console errors.
// 3. With --baseline: screenshots the element (or the viewport) and compares it pixel by pixel with the approved image.
//    --update writes the baseline. On a difference it writes <out>/diff.png (changed pixels in red) and a crop of the
//    changed area, <out>/changed.png: the model looks at that crop only, never at a full-page screenshot.
// Uses the project's own Playwright (never installs it). Exit: 0 pass, 1 fail, 2 usage, 3 not run (no Playwright).
// Zero model tokens: one verdict line plus failures.
const fs = require('fs');
const path = require('path');

function args(argv) {
  const o = { _: [], text: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--update') o.update = true;
    else if (a === '--text') o.text.push(argv[++i]);
    else if (a.startsWith('--')) o[a.slice(2)] = argv[++i];
    else o._.push(a);
  }
  return o;
}

function playwright(from) {
  for (const name of ['playwright', '@playwright/test', 'playwright-core']) {
    try { return require(require.resolve(name, { paths: [from] })); } catch {}
  }
  return null;
}

// Pixel diff inside the browser (canvas), so the skill needs no image library.
async function compare(page, aPng, bPng) {
  return page.evaluate(async ([a, b]) => {
    const load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
    const [ia, ib] = await Promise.all([load(a), load(b)]);
    if (ia.width !== ib.width || ia.height !== ib.height) return { sizeChanged: `${ib.width}x${ib.height} -> ${ia.width}x${ia.height}` };
    const w = ia.width; const h = ia.height;
    const ctx = (img) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x; };
    const da = ctx(ia).getImageData(0, 0, w, h).data; const db = ctx(ib).getImageData(0, 0, w, h).data;
    const dc = document.createElement('canvas'); dc.width = w; dc.height = h; const dx = dc.getContext('2d');
    dx.globalAlpha = 0.25; dx.drawImage(ia, 0, 0); dx.globalAlpha = 1;
    const out = dx.getImageData(0, 0, w, h);
    let n = 0; let x0 = w; let y0 = h; let x1 = -1; let y1 = -1;
    for (let p = 0; p < da.length; p += 4) {
      // A channel moving more than 24 of 255 counts: anti-aliasing noise stays below it.
      if (Math.abs(da[p] - db[p]) > 24 || Math.abs(da[p + 1] - db[p + 1]) > 24 || Math.abs(da[p + 2] - db[p + 2]) > 24) {
        n++; const q = p / 4; const x = q % w; const y = (q - x) / w;
        if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y;
        out.data[p] = 255; out.data[p + 1] = 0; out.data[p + 2] = 0; out.data[p + 3] = 255;
      }
    }
    dx.putImageData(out, 0, 0);
    let crop = null;
    if (n) {
      const pad = 16; const cx = Math.max(0, x0 - pad); const cy = Math.max(0, y0 - pad);
      const cw = Math.min(w, x1 + pad + 1) - cx; const ch = Math.min(h, y1 + pad + 1) - cy;
      const cc = document.createElement('canvas'); cc.width = cw; cc.height = ch;
      cc.getContext('2d').drawImage(ia, cx, cy, cw, ch, 0, 0, cw, ch);
      crop = { png: cc.toDataURL('image/png'), box: `${cx},${cy} ${cw}x${ch}` };
    }
    return { changed: n, ratio: n / (w * h), diff: dc.toDataURL('image/png'), crop };
  }, [aPng, bPng]);
}

const dataUrl = (buf) => 'data:image/png;base64,' + buf.toString('base64');
const fromDataUrl = (s) => Buffer.from(s.split(',')[1], 'base64');

async function check(o) {
  const pw = playwright(process.cwd());
  if (!pw) return { code: 3, lines: ['not run: Playwright is not installed in this project (the skill never installs it)'] };
  const out = path.resolve(o.out || path.join('page-check'));
  fs.mkdirSync(out, { recursive: true });
  const t = Number(o.timeout || 30) * 1000;
  // Playwright's own browser first; when its version was never downloaded, an installed Chrome or Edge, never a download.
  let browser; let used = 'bundled chromium';
  for (const [name, opts] of [['bundled chromium', {}], ['installed Chrome', { channel: 'chrome' }], ['installed Edge', { channel: 'msedge' }]]) {
    try { browser = await pw.chromium.launch(opts); used = name; break; } catch (e) {
      if (!/Executable doesn't exist|playwright install|not found|Chromium distribution/i.test(String(e.message))) throw e;
    }
  }
  if (!browser) return { code: 3, lines: ['not run: no browser for this Playwright and no Chrome or Edge; `npx playwright install chromium` in the project (the human decides)'] };
  const lines = used === 'bundled chromium' ? [] : [`browser: ${used} (Playwright's own is not downloaded)`]; let fail = false;
  try {
    const page = await browser.newPage({ viewport: { width: Number(o.width || 1280), height: Number(o.height || 800) }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e.message || e)));
    await page.goto(o._[0], { waitUntil: 'networkidle', timeout: t });
    await page.evaluate(() => document.fonts && document.fonts.ready);
    await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}' });
    if (o['wait-for']) await page.locator(o['wait-for']).first().waitFor({ state: 'visible', timeout: t });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const scope = o.element ? page.locator(o.element).first() : page.locator('body');
    const text = await scope.innerText({ timeout: t });
    for (const want of o.text) if (!text.includes(want)) { fail = true; lines.push(`missing text: "${want}"`); }
    if (errors.length) lines.push(`console errors: ${errors.length} (first: ${errors[0].slice(0, 160)})`);
    if (o.baseline) {
      const shot = o.element ? await scope.screenshot({ timeout: t }) : await page.screenshot();
      fs.writeFileSync(path.join(out, 'current.png'), shot);
      const base = path.resolve(o.baseline);
      if (o.update || !fs.existsSync(base)) {
        fs.mkdirSync(path.dirname(base), { recursive: true });
        fs.writeFileSync(base, shot);
        lines.push(`baseline ${o.update ? 'updated' : 'created'}: ${base} (approve it once by eye)`);
      } else {
        const r = await compare(page, dataUrl(shot), dataUrl(fs.readFileSync(base)));
        const max = Number(o['max-diff'] ?? 0.001);
        if (r.sizeChanged) { fail = true; lines.push(`image size changed ${r.sizeChanged}; current: ${path.join(out, 'current.png')}`); }
        else if (r.ratio > max) {
          fail = true;
          fs.writeFileSync(path.join(out, 'diff.png'), fromDataUrl(r.diff));
          fs.writeFileSync(path.join(out, 'changed.png'), fromDataUrl(r.crop.png));
          lines.push(`image differs: ${r.changed} px (${(r.ratio * 100).toFixed(2)}%) in ${r.crop.box}; look at ${path.join(out, 'changed.png')} only`);
        } else lines.push(`image matches (${r.changed} px changed, limit ${(max * 100).toFixed(2)}%)`);
      }
    }
  } catch (e) {
    fail = true; lines.push(`error: ${String(e.message || e).split('\n')[0]}`);
  } finally { await browser.close(); }
  return { code: fail ? 1 : 0, lines };
}

if (require.main === module) {
  const o = args(process.argv.slice(2));
  if (!o._[0]) { console.error('usage: page-check.cjs <url> [--wait-for SEL] [--text T]... [--element SEL] [--baseline FILE.png [--update]] [--max-diff R] [--out DIR]'); process.exit(2); }
  check(o).then((r) => {
    console.log(`page-check: ${['pass', 'FAIL', '', 'not run'][r.code]} ${o._[0]}`);
    if (r.lines.length) console.log(r.lines.join('\n'));
    process.exit(r.code);
  }, (e) => { console.error(String(e.message || e)); process.exit(1); });
}

module.exports = { check, args };
