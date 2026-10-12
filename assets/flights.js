// MW Photo Tours · "Add your flights": each traveler types their own flights (from home to the expedition and back).
// From and To are picked from a list of airports (assets/airports.js, loaded when the sheet opens), so every flight
// carries the airport's place and the page can draw the traveler's own route on the map.
(function (root) {
'use strict';
const BASE = ((document.currentScript && document.currentScript.src) || '').replace(/[^/]*$/, '');
let AP = null;
function airports() {
  if (AP) return AP;
  return AP = new Promise((res, rej) => {
    if (root.MW_AIRPORTS) return res(root.MW_AIRPORTS);
    const s = document.createElement('script'); s.src = BASE + 'airports.js?v=1'; s.async = true;
    s.onload = () => res(root.MW_AIRPORTS || []); s.onerror = () => { AP = null; rej(new Error('load')); };
    document.head.appendChild(s);
  });
}
// the main hubs come first when a city has several airports (London → LHR before LGW)
const HUBS = new Set('LHR JFK CDG HKG TLV DEL BOM KEF MAD BCN FRA AMS IST DXB AUH DOH SIN BKK NRT HND ICN PEK PVG CAN TPE MNL KUL CGK SYD MEL AKL LAX SFO ORD ATL DFW DEN SEA MIA BOS EWR IAD YYZ YVR YUL MEX GRU EZE SCL BOG LIM JNB CPT CAI ADD NBO FCO MXP MUC ZRH GVA VIE CPH ARN OSL HEL LIS OPO ATH WAW PRG BUD DUB MAN BRU MLE CMB KTM DAC'.split(' '));
const fold = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
// best matches for what was typed: the code itself, then codes, cities, countries and airport names that start with it
function search(list, q) {
  q = fold(q).trim(); if (!q) return [];
  const Q = q.toUpperCase(), out = [];
  const score = a => {
    if (a[0] === Q) return 0;
    const city = fold(a[1]), country = fold(a[2]), name = fold(a[6]);
    if (q.length <= 3 && a[0].startsWith(Q)) return 1;
    if (city.startsWith(q)) return 2;
    if (country.startsWith(q)) return 3;
    if (city.includes(q) || name.includes(q)) return 4;
    if (country.includes(q)) return 5;
    return -1;
  };
  for (const a of list) { const s = score(a); if (s >= 0) out.push([s - a[5] * 0.5 - (HUBS.has(a[0]) ? 0.3 : 0), a]); }
  return out.sort((x, y) => x[0] - y[0]).slice(0, 7).map(x => x[1]);
}

const W = {
  he: { title: 'הטיסות שלכם', intro: 'מלאו כל טיסה: מהבית אל המסע, ובחזרה. במ- ובאל הקלידו עיר, מדינה או קוד שדה תעופה, ובחרו מהרשימה.',
        from: 'מ-', to: 'אל', date: 'תאריך', dep: 'המראה', arr: 'נחיתה', no: 'מספר טיסה (לא חובה)', pick: 'עיר או שדה תעופה',
        add: '+ טיסה', save: 'שמירה', cancel: 'ביטול', del: 'הסרה', clear: 'מחיקת כל הטיסות', clearQ: 'למחוק את כל הטיסות שלכם?',
        need: 'בכל טיסה צריך תאריך, ושדה תעופה ב-מ- וב-אל מתוך הרשימה.', none: 'לא נמצא שדה תעופה. נסו שם עיר או קוד של שלוש אותיות.',
        loadErr: 'רשימת שדות התעופה לא נטענה. בדקו את החיבור ונסו שוב.', privacy: 'רק אתם רואים את הטיסות שלכם.' },
  en: { title: 'Your flights', intro: 'Add each flight, from home to the expedition and back. In From and To type a city, country or airport code, then pick from the list.',
        from: 'From', to: 'To', date: 'Date', dep: 'Departs', arr: 'Lands', no: 'Flight no. (optional)', pick: 'City or airport',
        add: '+ Flight', save: 'Save', cancel: 'Cancel', del: 'Remove', clear: 'Delete all flights', clearQ: 'Delete all your flights?',
        need: 'Each flight needs a date, and a From and To airport picked from the list.', none: 'No airport found. Try a city name or a three-letter code.',
        loadErr: "The airport list didn't load. Check your connection and try again.", privacy: 'Only you see your flights.' },
};
const words = () => W[(document.documentElement.lang || 'he').startsWith('en') ? 'en' : 'he'];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// "1655", "16.55", "7:20" → "16:55", "07:20"
const hhmm = v => { const m = String(v || '').trim().match(/^(\d{1,2})\D?(\d{2})$/); return m && +m[1] < 24 && +m[2] < 60 ? `${m[1].padStart(2, '0')}:${m[2]}` : String(v || '').trim(); };

const CSS = `
.mwf{position:fixed;inset:0;z-index:90;display:grid;place-items:center;padding:16px;background:rgba(5,5,4,.78);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
.mwf form{position:relative;width:min(620px,100%);max-height:calc(100vh - 32px);overflow:auto;display:grid;gap:14px;padding:22px;border-radius:22px;background:#12100E;border:1px solid rgba(254,251,241,.14);color:#F4F4F4;box-shadow:0 30px 80px rgba(0,0,0,.6);font-family:inherit}
.mwf h2{margin:0;font-size:22px;color:#FEFBF1}
.mwf p{margin:0;font-size:14.5px;line-height:1.5;color:rgba(244,244,244,.78)}
.mwf .msg{color:#F4AF56;min-height:0}
.mwf .x{position:absolute;top:12px;inset-inline-end:12px;width:38px;height:38px;border-radius:50%;border:1px solid rgba(254,251,241,.18);background:none;color:#FEFBF1;font-size:20px;cursor:pointer}
.mwf .rows{display:grid;gap:12px}
.mwf .fr{position:relative;display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:12px;border-radius:16px;background:rgba(254,251,241,.04);border:1px solid rgba(254,251,241,.08)}
.mwf .fr.on{border-color:rgba(244,175,86,.6)}
.mwf .fr .t4{grid-column:1 / -1;display:grid;grid-template-columns:1.4fr 1fr 1fr 1.3fr auto;gap:8px;align-items:end}
.mwf label{position:relative;display:grid;gap:4px;font-size:11.5px;color:rgba(244,244,244,.56)}
.mwf input{width:100%;min-width:0;height:40px;padding-inline:10px;border-radius:10px;border:1px solid rgba(254,251,241,.22);background:rgba(10,9,8,.5);color:#FEFBF1;font:600 14px/1 inherit;font-family:inherit;color-scheme:dark}
.mwf input:focus{outline:none;border-color:#F4AF56}
.mwf input.ok{border-color:rgba(169,196,140,.6)}
.mwf .ap small{display:block;min-height:14px;font-size:11.5px;color:#A9C48C;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mwf .sug{position:absolute;z-index:3;top:62px;inset-inline:0;display:grid;max-height:260px;overflow:auto;border-radius:12px;background:#1B1814;border:1px solid rgba(254,251,241,.18);box-shadow:0 16px 40px rgba(0,0,0,.55)}
.mwf .sug button{display:grid;grid-template-columns:44px 1fr;gap:8px;align-items:center;text-align:start;padding:9px 12px;border:0;border-bottom:1px solid rgba(254,251,241,.06);background:none;color:#F4F4F4;font:500 13.5px/1.3 inherit;font-family:inherit;cursor:pointer}
.mwf .sug button:hover,.mwf .sug button:focus{background:rgba(244,175,86,.12);outline:none}
.mwf .sug b{color:#F4AF56;letter-spacing:.06em}
.mwf .sug span small{display:block;color:rgba(244,244,244,.5);font-size:11.5px}
.mwf .sug .no{padding:10px 12px;font-size:13px;color:rgba(244,244,244,.6)}
.mwf .rm{width:38px;height:40px;border-radius:10px;border:1px solid rgba(240,138,122,.4);background:none;color:#F7B2A6;font-size:18px;cursor:pointer}
.mwf .acts{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.mwf .acts .sp{flex:1}
.mwf button.b{min-height:42px;padding-inline:16px;border-radius:64px;border:1px solid rgba(244,244,244,.35);background:none;color:#F4F4F4;font:700 14px/1 inherit;font-family:inherit;cursor:pointer}
.mwf button.b.go{border-color:#F4AF56;background:rgba(244,175,86,.14)}
.mwf button.b.clear{border-color:rgba(240,138,122,.45);color:#F7B2A6}
.mwf small.pv{font-size:12px;color:rgba(244,244,244,.5)}
@media (max-width:560px){.mwf form{padding:18px 14px}.mwf .fr .t4{grid-template-columns:1fr 1fr}.mwf .fr .t4 .w2{grid-column:1 / -1}.mwf .rm{width:100%}}
`;

// the sheet: the traveler's flights to check, add, edit or remove; resolves with the saved list (or null)
function open(opts = {}) {
  const w = words();
  if (!document.getElementById('mwf-css')) { const st = document.createElement('style'); st.id = 'mwf-css'; st.textContent = CSS; document.head.appendChild(st); }
  return new Promise(resolve => {
    let rows = (opts.rows || []).map(r => ({ ...r }));
    if (!rows.length) rows.push({});
    let list = [], seq = 0;
    const v = document.createElement('div'); v.className = 'mwf'; v.dir = document.documentElement.dir || 'rtl';
    v.innerHTML = `<form novalidate autocomplete="off"><button type="button" class="x" aria-label="${esc(w.cancel)}">×</button><h2>${esc(w.title)}</h2>
      <p>${esc(w.intro)}</p><p class="msg" role="status"></p><div class="rows"></div>
      <div class="acts"><button type="button" class="b" data-add>${esc(w.add)}</button><span class="sp"></span>
        ${opts.rows && opts.rows.length ? `<button type="button" class="b clear" data-clear>${esc(w.clear)}</button>` : ''}
        <button type="submit" class="b go">${esc(w.save)}</button></div>
      <small class="pv">${esc(w.privacy)}</small></form>`;
    const f = v.querySelector('form'), box = v.querySelector('.rows'), msg = v.querySelector('.msg');
    const apField = (r, k) => {
      const code = r[k], city = r[k + 'City'];
      return `<label class="ap">${esc(w[k])}<input data-ap="${k}" type="text" dir="auto" placeholder="${esc(w.pick)}" value="${esc(code ? `${code}${city ? ' · ' + city : ''}` : '')}"${code && r[k + 'LL'] ? ' class="ok"' : ''}><small>${esc(r[k + 'Name'] || '')}</small></label>`;
    };
    const inp = (r, k, label, type, extra = '') => `<label class="${extra}">${esc(label)}<input data-k="${k}" type="${type}" dir="ltr" value="${esc(r[k] || '')}"${type === 'text' && k !== 'flight' ? ' inputmode="numeric" maxlength="5" placeholder="00:00"' : ''}></label>`;
    const draw = () => {
      box.innerHTML = rows.map((r, n) => `<div class="fr" data-n="${n}">${apField(r, 'from')}${apField(r, 'to')}
        <div class="t4">${inp(r, 'iso', w.date, 'date', 'w2')}${inp(r, 'time', w.dep, 'text')}${inp(r, 'arrive', w.arr, 'text')}${inp(r, 'flight', w.no, 'text', 'w2')}
        <button type="button" class="rm" data-rm="${n}" aria-label="${esc(w.del)}">×</button></div></div>`).join('');
    };
    const read = () => box.querySelectorAll('.fr').forEach(el => {
      const r = rows[+el.dataset.n];
      el.querySelectorAll('input[data-k]').forEach(i => { const k = i.dataset.k; r[k] = k === 'time' || k === 'arrive' ? hhmm(i.value) : k === 'flight' ? i.value.trim().toUpperCase() : i.value.trim(); });
    });
    const closeSug = () => v.querySelectorAll('.sug').forEach(s => s.remove());
    const choose = (r, k, a) => { r[k] = a[0]; r[k + 'City'] = a[1]; r[k + 'Country'] = a[2]; r[k + 'LL'] = [a[3], a[4]]; r[k + 'Name'] = a[6]; };
    box.addEventListener('input', async e => {
      const i = e.target.closest('input[data-ap]'); if (!i) return;
      const r = rows[+i.closest('.fr').dataset.n], k = i.dataset.ap;
      ['', 'City', 'Country', 'LL', 'Name'].forEach(x => { delete r[k + x]; }); i.classList.remove('ok'); i.nextElementSibling.textContent = '';
      const tok = ++seq;
      try { if (!list.length) list = await airports(); } catch (er) { msg.textContent = w.loadErr; return; }
      if (tok !== seq) return;   // a newer keystroke is already handled
      closeSug();
      const found = search(list, i.value); if (!i.value.trim()) return;
      const s = document.createElement('div'); s.className = 'sug';
      s.innerHTML = found.length ? found.map((a, j) => `<button type="button" data-j="${j}"><b>${esc(a[0])}</b><span>${esc(a[1])}, ${esc(a[2])}<small>${esc(a[6])}</small></span></button>`).join('') : `<div class="no">${esc(w.none)}</div>`;
      s.addEventListener('pointerdown', ev => ev.preventDefault());   // keep the field focused while picking
      s.addEventListener('click', ev => {
        const b = ev.target.closest('button[data-j]'); if (!b) return;
        const a = found[+b.dataset.j]; choose(r, k, a);
        i.value = `${a[0]} · ${a[1]}`; i.classList.add('ok'); i.nextElementSibling.textContent = a[6]; closeSug();
        const next = k === 'from' ? i.closest('.fr').querySelector('input[data-ap="to"]') : i.closest('.fr').querySelector('input[data-k="iso"]');
        if (next) next.focus();
      });
      i.closest('label').appendChild(s);
    });
    box.addEventListener('keydown', e => {
      const i = e.target.closest('input[data-ap]'); if (!i || e.key !== 'Enter') return;
      e.preventDefault(); const b = i.closest('label').querySelector('.sug button'); if (b) b.click();
    });
    box.addEventListener('focusout', e => {   // leaving a field closes its own list (not the next field's)
      if (!e.target.matches('input[data-ap]')) return; const lab = e.target.closest('label');
      setTimeout(() => { if (!lab.contains(document.activeElement)) lab.querySelectorAll('.sug').forEach(x => x.remove()); }, 150);
    });
    const close = val => { v.remove(); resolve(val); };
    v.querySelector('.x').onclick = () => close(null);
    v.addEventListener('pointerdown', e => { if (e.target === v) close(null); });
    f.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.rm != null) { read(); rows.splice(+b.dataset.rm, 1); if (!rows.length) rows.push({}); draw(); }
      else if (b.hasAttribute('data-add')) { read(); rows.push({}); draw(); box.lastElementChild.querySelector('input').focus(); }
      else if (b.hasAttribute('data-clear')) { if (confirm(w.clearQ)) close([]); }
    });
    f.onsubmit = e => {
      e.preventDefault(); read();
      const filled = rows.filter(r => r.iso || r.from || r.to || r.time || r.flight || r.arrive);
      if (filled.some(r => !r.iso || !r.fromLL || !r.toLL)) { msg.textContent = w.need; return; }
      close(filled.sort((a, b) => (a.iso + (a.time || '')).localeCompare(b.iso + (b.time || ''))));
    };
    draw(); document.body.appendChild(v);
    airports().then(l => { list = l; }).catch(() => {});
    if (opts.focus != null && box.children[opts.focus]) { const el = box.children[opts.focus]; el.classList.add('on'); el.scrollIntoView({ block: 'center' }); }
    setTimeout(() => { const first = (opts.focus != null && box.children[opts.focus]) || box.lastElementChild; const i = first && first.querySelector('input'); if (i && !(opts.rows || []).length) i.focus({ preventScroll: true }); }, 60);
  });
}

root.MWFlights = { open, search, airports };
})(window);
