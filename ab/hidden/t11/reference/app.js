const trig = document.getElementById('country');
let panel, input, list, items = [], page = 1, total = 0, q = '', active = -1, loading = false, timer, ctrl;
function place() {
  const r = trig.getBoundingClientRect(), below = innerHeight - r.bottom - 8, above = r.top - 8;
  const up = below < 240 && above > below, h = Math.min(320, Math.max(120, up ? above : below));
  Object.assign(panel.style, { left: r.left + 'px', width: r.width + 'px', maxHeight: h + 'px', top: up ? '' : r.bottom + 4 + 'px', bottom: up ? innerHeight - r.top + 4 + 'px' : '' });
  list.style.maxHeight = h - 60 + 'px';
}
async function load(reset) {
  if (reset) { page = 1; items = []; } else if (loading || items.length >= total) return;
  if (ctrl) ctrl.abort(); ctrl = new AbortController(); loading = true;
  try {
    const r = await fetch(`/api/countries?q=${encodeURIComponent(q)}&page=${page}&limit=20`, { signal: ctrl.signal });
    const d = await r.json(); total = d.total; items = items.concat(d.items); page++; render();
  } catch (e) { if (e.name !== 'AbortError') list.innerHTML = '<li>Could not load. Scroll to retry.</li>'; }
  loading = false;
}
function render() {
  list.innerHTML = items.length ? '' : '<li role="presentation">No results</li>';
  items.forEach((c, i) => { const li = document.createElement('li'); li.id = 'opt-' + c.code; li.setAttribute('role', 'option'); li.dataset.value = c.code; li.textContent = c.name; li.setAttribute('aria-selected', i === active); li.onmousedown = (e) => { e.preventDefault(); pick(i); }; list.appendChild(li); });
}
function setActive(i) { active = Math.max(0, Math.min(items.length - 1, i)); render(); input.setAttribute('aria-activedescendant', 'opt-' + items[active].code); document.getElementById('opt-' + items[active].code).scrollIntoView({ block: 'nearest' }); }
function open() {
  if (panel) return;
  panel = document.createElement('div'); panel.className = 'panel';
  panel.innerHTML = '<input type="search" role="combobox" aria-expanded="true" aria-controls="clist" aria-label="Search countries"><ul class="list" id="clist" role="listbox"></ul>';
  document.body.appendChild(panel); input = panel.querySelector('input'); list = panel.querySelector('ul');
  q = ''; active = -1; place(); requestAnimationFrame(() => panel.classList.add('open'));
  trig.setAttribute('aria-expanded', 'true'); input.focus(); load(true);
  input.oninput = () => { clearTimeout(timer); timer = setTimeout(() => { q = input.value.trim(); active = -1; load(true); }, 250); };
  input.onkeydown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); if (active >= 0) pick(active); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'Tab') close(false);
  };
  list.onscroll = () => { if (list.scrollTop + list.clientHeight >= list.scrollHeight - 40) load(false); };
}
function close(focus = true) { if (!panel) return; panel.remove(); panel = null; trig.setAttribute('aria-expanded', 'false'); if (focus) trig.focus(); }
function pick(i) { trig.textContent = items[i].name; trig.dataset.value = items[i].code; close(); }
trig.onclick = (e) => { if (e.detail === 0) return; panel ? close() : open(); };
trig.onkeydown = (e) => { if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); open(); } };
document.addEventListener('mousedown', (e) => { if (panel && !panel.contains(e.target) && e.target !== trig) close(false); });
addEventListener('resize', () => panel && place()); addEventListener('scroll', () => panel && place(), true);

const toast = document.getElementById('toast');
fetch('/api/settings').then((r) => r.json()).then((s) => document.querySelectorAll('[data-setting]').forEach((el) => { el.checked = !!s[el.dataset.setting]; }));
document.querySelectorAll('[data-setting]').forEach((el) => el.addEventListener('change', async () => {
  const key = el.dataset.setting, value = el.checked;
  try { const r = await fetch('/api/settings', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key, value }) }); if (!r.ok) throw 0; }
  catch { el.checked = !value; toast.textContent = `Could not save ${key}. Try again.`; }
}));

const pay = document.getElementById('pay'), st = document.getElementById('pay-status');
pay.onclick = async () => {
  pay.disabled = true; pay.setAttribute('aria-busy', 'true'); st.textContent = 'Processing payment...';
  try {
    const r = await fetch('/api/pay', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ plan: 'pro', amountCents: 4900 }) });
    const d = await r.json(); st.textContent = r.ok ? `Paid. Receipt ${d.receipt}.` : `Payment failed: ${d.error}. Try another card.`;
  } catch { st.textContent = 'Payment failed: network error. Try again.'; }
  pay.disabled = false; pay.removeAttribute('aria-busy');
};
