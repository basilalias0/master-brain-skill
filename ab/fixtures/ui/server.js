'use strict';
// Shop settings API and static server. Run: node server.js (PORT, default 4317).
const http = require('http');
const fs = require('fs');
const path = require('path');

const NAMES = ['Albania','Argentina','Australia','Austria','Belgium','Brazil','Canada','Chile','China','Colombia','Croatia','Denmark','Egypt','Estonia','Finland','France','Germany','Ghana','Greece','Hungary','Iceland','India','Indonesia','Ireland','Israel','Italy','Japan','Jordan','Kenya','Latvia','Malaysia','Mexico','Morocco','Nepal','Netherlands','New Zealand','Nigeria','Norway','Oman','Pakistan','Peru','Philippines','Poland','Portugal','Qatar','Romania','Saudi Arabia','Singapore','Spain','Sweden','Switzerland','Thailand','Turkey','Uganda','Ukraine','United Arab Emirates','United Kingdom','United States','Uruguay','Vietnam'];
// 240 entries: each name plus 3 regions, so the list is too long to load at once.
const COUNTRIES = [];
NAMES.forEach((n, i) => ['', ' (North)', ' (South)', ' (East)'].forEach((r, j) => COUNTRIES.push({ code: `C${i * 4 + j}`, name: n + r })));
const settings = { email: true, sms: false, marketing: false };
const FAIL = (process.env.FAIL_SETTINGS || '').split(',').filter(Boolean);
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const send = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
const body = (req) => new Promise((r) => { let s = ''; req.on('data', (c) => (s += c)); req.on('end', () => { try { r(JSON.parse(s || '{}')); } catch { r({}); } }); });

http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/api/countries' && req.method === 'GET') {
    // ?q= filters by name (case-insensitive); ?page= starts at 1; ?limit= max 50, default 20.
    await delay(300);
    const q = (u.searchParams.get('q') || '').toLowerCase();
    const limit = Math.min(50, Number(u.searchParams.get('limit')) || 20);
    const page = Math.max(1, Number(u.searchParams.get('page')) || 1);
    const all = COUNTRIES.filter((c) => c.name.toLowerCase().includes(q));
    return send(res, 200, { items: all.slice((page - 1) * limit, page * limit), total: all.length, page, limit });
  }
  if (u.pathname === '/api/settings' && req.method === 'GET') return send(res, 200, settings);
  if (u.pathname === '/api/settings' && req.method === 'PATCH') {
    // Body {key, value}. Slow on purpose, like a real network.
    const b = await body(req); await delay(1200);
    if (!(b.key in settings) || typeof b.value !== 'boolean') return send(res, 400, { error: 'bad setting' });
    if (FAIL.includes(b.key)) return send(res, 500, { error: 'could not save' });
    settings[b.key] = b.value; return send(res, 200, settings);
  }
  if (u.pathname === '/api/pay' && req.method === 'POST') {
    // Body {plan: "pro", amountCents: 4900}. 200 {status:"paid"} or 402 {error} when the card is declined.
    await body(req); await delay(1500);
    if (process.env.PAY_FAIL) return send(res, 402, { error: 'card declined' });
    return send(res, 200, { status: 'paid', receipt: 'R-1001' });
  }
  const file = path.join(__dirname, 'public', u.pathname === '/' ? 'index.html' : decodeURIComponent(u.pathname).slice(1));
  if (!file.startsWith(path.join(__dirname, 'public')) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('not found'); }
  const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[path.extname(file)] || 'application/octet-stream';
  res.writeHead(200, { 'content-type': type }); fs.createReadStream(file).pipe(res);
}).listen(Number(process.env.PORT) || 4317);
