// MW Photo Tours · "Add your flight ticket": read a ticket (PDF, JPG or PNG) in the browser, find the flights,
// let the traveler check them, and give them back to the page. Nothing is uploaded: the file never leaves the phone.
// PDFs are read with pdf.js; photos (and scanned PDFs) with Tesseract OCR. Both load only when a ticket is added.
(function (root) {
'use strict';

// ---------- reading the words of a ticket ----------
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const TESSERACT = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
const loaded = {};
function script(src) {
  return loaded[src] || (loaded[src] = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = src; s.async = true;
    s.onload = res; s.onerror = () => { delete loaded[src]; rej(new Error('load')); };
    document.head.appendChild(s);
  }));
}
async function ocr(image) {
  await script(TESSERACT);
  const r = await root.Tesseract.recognize(image, 'eng');
  return (r && r.data && r.data.text) || '';
}
// a PDF page's words in reading order: rows from top to bottom, words left to right
function pageText(content) {
  const items = content.items.filter(i => i.str && i.str.trim()).map(i => ({ s: i.str, x: i.transform[4], y: Math.round(i.transform[5]) }));
  items.sort((a, b) => b.y - a.y || a.x - b.x);
  const lines = []; let cur = null;
  for (const it of items) {
    if (!cur || Math.abs(cur.y - it.y) > 3) { cur = { y: it.y, w: [] }; lines.push(cur); }
    cur.w.push(it);
  }
  return lines.map(l => l.w.sort((a, b) => a.x - b.x).map(w => w.s).join(' ')).join('\n');
}
async function textOf(file) {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
  if (!isPdf) return ocr(file);
  await script(PDFJS);
  const lib = root.pdfjsLib; lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  let text = '';
  for (let n = 1; n <= Math.min(doc.numPages, 8); n++) {
    const page = await doc.getPage(n);
    let t = pageText(await page.getTextContent());
    if (t.replace(/\s/g, '').length < 40) {          // a scanned page: read the picture instead
      const vp = page.getViewport({ scale: 2 }), c = document.createElement('canvas');
      c.width = vp.width; c.height = vp.height;
      await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
      t = await ocr(c);
    }
    text += t + '\n';
  }
  return text;
}

// ---------- finding the flights in the words ----------
// airports a traveler of MW Photo Tours is likely to see (more can be added); only these count as airports
const AIRPORTS = new Set(('TLV ETM HFA VDA EIL ' +
  'AUH DXB SHJ DOH BAH MCT KWI RUH JED AMM CAI IST SAW ATH LCA ' +
  'DEL BOM BLR MAA CCU HYD GAU IXB BBI COK GOI AMD JAI LKO PAT VNS IXA DIB JRH IXZ SXR IXL ' +
  'KTM PBH DAC CMB MLE BKK DMK HKT CNX SIN KUL CGK DPS MNL CEB HKG TPE ICN NRT HND KIX PEK PKX PVG CAN ' +
  'MAD BCN AGP SVQ VLC PMI IBZ LIS OPO FAO GRX ALC BIO ' +
  'CDG ORY NCE LYS MRS TLS BOD FCO MXP LIN VCE BLQ NAP FLR PSA CTA ' +
  'LHR LGW STN LTN MAN EDI DUB AMS BRU FRA MUC BER DUS HAM CGN STR ZRH GVA BSL VIE PRG BUD WAW KRK ' +
  'CPH OSL ARN HEL KEF RAK CMN TUN ADD NBO JRO KGL EBB JNB CPT DAR ZNZ WDH ' +
  'JFK EWR LAX SFO MIA ORD YYZ GRU EZE LIM BOG SCL SYD MEL AKL').split(/\s+/));
const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const MONRX = '(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\\.?';
const pad = n => String(n).padStart(2, '0');

function allDates(text, year) {
  const out = [];
  const add = (i, d, m, y) => {
    y = y ? (String(y).length === 2 ? 2000 + +y : +y) : year;
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y > 2000 && y < 2100) out.push({ i, iso: `${y}-${pad(m)}-${pad(d)}` });
  };
  let m;
  const r1 = new RegExp('\\b(\\d{1,2})\\s*' + MONRX + ',?\\s*(\\d{4}|\\d{2}\\b)?', 'gi');          // 1 Nov 2026, 01NOV26
  while ((m = r1.exec(text))) add(m.index, +m[1], MON[m[2].toLowerCase()], m[3]);
  const r2 = new RegExp('\\b' + MONRX + '\\s+(\\d{1,2})(?!\\d)(?:st|nd|rd|th)?,?\\s*(\\d{4})?', 'gi');  // Nov 1, 2026 (not 'Nov 2026')
  while ((m = r2.exec(text))) add(m.index, +m[2], MON[m[1].toLowerCase()], m[3]);
  const r3 = /\b(\d{4})-(\d{2})-(\d{2})\b/g;                                                      // 2026-11-01
  while ((m = r3.exec(text))) add(m.index, +m[3], +m[2], m[1]);
  const r4 = /\b(\d{1,2})[\/.](\d{1,2})[\/.](\d{4}|\d{2})\b/g;                                    // 01/11/2026 (day first)
  while ((m = r4.exec(text))) add(m.index, +m[1], +m[2], m[3]);
  return out.sort((a, b) => a.i - b.i);
}

function parse(text, opts = {}) {
  const year = opts.year || new Date().getFullYear();
  const T = String(text || '').replace(/\r/g, '');
  const dates = allDates(T, year);
  const times = []; { const r = /\b([01]?\d|2[0-3]):([0-5]\d)\b/g; let m; while ((m = r.exec(T))) times.push({ i: m.index, t: `${pad(m[1])}:${m[2]}` }); }
  const aps = []; { const r = /\b([A-Z]{3})\b/g; let m; while ((m = r.exec(T))) if (AIRPORTS.has(m[1])) aps.push({ i: m.index, c: m[1] }); }
  const fls = []; { const r = /\b([A-Z]{2}|[A-Z]\d|\d[A-Z])\s?-?\s?(\d{2,4})\b/g; let m;
    while ((m = r.exec(T))) { if (AIRPORTS.has(m[1] + m[2][0])) continue; fls.push({ i: m.index, end: m.index + m[0].length, no: `${m[1]} ${+m[2]}` }); } }
  // each flight number owns the text between its neighbours; in it, the airport pair, times and date closest to it
  // (tickets print them before or after the number, so both sides count)
  const pairs = [];
  for (let n = 0; n + 1 < aps.length; n++) if (aps[n].c !== aps[n + 1].c && aps[n + 1].i - aps[n].i < 220) pairs.push({ a: aps[n], b: aps[n + 1], mid: (aps[n].i + aps[n + 1].i) / 2 });
  const rows = [];
  fls.forEach((f, k) => {
    const lo = k ? fls[k - 1].end : 0, hi = k + 1 < fls.length ? fls[k + 1].i : T.length, at = (f.i + f.end) / 2;
    const near = (list, pos) => list.slice().sort((x, y) => Math.abs(pos(x) - at) - Math.abs(pos(y) - at));
    const pair = near(pairs.filter(p => p.a.i >= lo && p.b.i < hi && Math.abs(p.mid - at) < 500), p => p.mid)[0];
    if (!pair) return;
    // times: from the line of the first airport to the end of the line of the second (dep, then arrival)
    const ls = T.lastIndexOf('\n', pair.a.i) + 1, le = (T.indexOf('\n', pair.b.i) + 1 || T.length + 1) - 1;
    let tm = times.filter(t => t.i >= ls && t.i <= le && t.i >= lo && t.i < hi);
    if (!tm.length) tm = near(times.filter(t => t.i >= lo && t.i < hi && Math.abs(t.i - at) < 300), t => t.i).slice(0, 2).sort((x, y) => x.i - y.i);
    // the date: the closest in its own part, or else the last one printed before it (a heading over several flights)
    const d = near(dates.filter(x => x.i >= lo && x.i < hi && Math.abs(x.i - at) < 600), x => x.i)[0] || dates.filter(x => x.i < f.i).pop();
    if (!d) return;
    rows.push({ iso: d.iso, time: tm[0] ? tm[0].t : '', from: pair.a.c, to: pair.b.c, flight: f.no, arrive: tm[1] ? tm[1].t : '' });
  });
  // a photo read by OCR often loses the small flight number: then a line holding two airports and a time is a flight
  // ("DEL 07:20 hrs … 09:45 hrs GAU"), dated by the date printed before it; the traveler adds the number in the sheet
  if (!rows.length) {
    let at = 0;
    for (const line of T.split('\n')) {
      const ls = at; at += line.length + 1;
      const ap = aps.filter(x => x.i >= ls && x.i < ls + line.length), tm = times.filter(t => t.i >= ls && t.i < ls + line.length);
      if (ap.length < 2 || ap[0].c === ap[1].c || !tm.length) continue;
      const d = dates.filter(x => x.i < ls).pop() || dates.find(x => x.i >= ls);
      if (d) rows.push({ iso: d.iso, time: tm[0].t, from: ap[0].c, to: ap[1].c, flight: '', arrive: tm[1] ? tm[1].t : '' });
    }
  }
  // one row per flight and day
  const seen = new Set();
  return rows.filter(r => { const k = (r.flight || r.from + r.to) + r.iso; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => (a.iso + a.time).localeCompare(b.iso + b.time));
}

// ---------- checking the flights with the traveler ----------
const W = {
  he: { title: 'הטיסות שלכם', noNo: 'מספר הטיסה לא נקרא מהתמונה, הוסיפו אותו ידנית.', reading: 'קוראים את הכרטיס…', found: n => n === 1 ? 'נמצאה טיסה אחת. בדקו שהפרטים נכונים.' : `נמצאו ${n} טיסות. בדקו שהפרטים נכונים.`,
        none: 'לא הצלחנו לקרוא טיסות מהקובץ הזה. אפשר להוסיף אותן כאן ידנית.', failed: 'לא הצלחנו לפתוח את הקובץ. נסו PDF, JPG או PNG.', offline: 'כדי לקרוא כרטיס צריך חיבור לאינטרנט.',
        date: 'תאריך', dep: 'המראה', from: 'מ-', to: 'ל-', no: 'מספר טיסה', arr: 'נחיתה', add: '+ טיסה', more: 'כרטיס נוסף', save: 'שמירה', cancel: 'ביטול', del: 'הסרה',
        clear: 'מחיקת כל הטיסות', clearQ: 'למחוק את כל הטיסות שלכם?', privacy: 'הכרטיס נקרא בטלפון שלכם ולא נשלח לשום מקום.' },
  en: { title: 'Your flights', noNo: 'The flight number could not be read from the photo, please type it in.', reading: 'Reading your ticket…', found: n => n === 1 ? 'Found 1 flight. Check the details are right.' : `Found ${n} flights. Check the details are right.`,
        none: "We couldn't read flights from this file. You can add them here by hand.", failed: "We couldn't open that file. Try a PDF, JPG or PNG.", offline: 'Reading a ticket needs an internet connection.',
        date: 'Date', dep: 'Departs', from: 'From', to: 'To', no: 'Flight', arr: 'Lands', add: '+ Flight', more: 'Another ticket', save: 'Save', cancel: 'Cancel', del: 'Remove',
        clear: 'Delete all flights', clearQ: 'Delete all your flights?', privacy: 'Your ticket is read on your phone and is not sent anywhere.' },
};
const words = () => W[(document.documentElement.lang || 'he').startsWith('en') ? 'en' : 'he'];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const CSS = `
.mwt{position:fixed;inset:0;z-index:90;display:grid;place-items:center;padding:16px;background:rgba(5,5,4,.78);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
.mwt form{position:relative;width:min(640px,100%);max-height:calc(100vh - 32px);overflow:auto;display:grid;gap:14px;padding:22px;border-radius:22px;background:#12100E;border:1px solid rgba(254,251,241,.14);color:#F4F4F4;box-shadow:0 30px 80px rgba(0,0,0,.6);font-family:inherit}
.mwt h2{margin:0;font-size:22px;color:#FEFBF1}
.mwt p{margin:0;font-size:14.5px;color:rgba(244,244,244,.78)}
.mwt .msg.warn{color:#F4AF56}
.mwt .x{position:absolute;top:12px;inset-inline-end:12px;width:38px;height:38px;border-radius:50%;border:1px solid rgba(254,251,241,.18);background:none;color:#FEFBF1;font-size:20px;cursor:pointer}
.mwt .rows{display:grid;gap:10px}
.mwt .row{display:grid;grid-template-columns:1.3fr .8fr .7fr .7fr 1fr .8fr auto;gap:6px;align-items:end;padding:10px;border-radius:14px;background:rgba(254,251,241,.04);border:1px solid rgba(254,251,241,.08)}
.mwt label{display:grid;gap:4px;font-size:11px;color:rgba(244,244,244,.56)}
.mwt input{width:100%;min-width:0;height:38px;padding-inline:8px;border-radius:10px;border:1px solid rgba(254,251,241,.22);background:rgba(10,9,8,.5);color:#FEFBF1;font:600 14px/1 inherit;font-family:inherit;color-scheme:dark}
.mwt input:focus{outline:none;border-color:#F4AF56}
.mwt input.code{text-transform:uppercase;letter-spacing:.06em}
.mwt .rm{width:34px;height:38px;border-radius:10px;border:1px solid rgba(240,138,122,.4);background:none;color:#F7B2A6;font-size:18px;cursor:pointer}
.mwt .acts{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.mwt .acts .sp{flex:1}
.mwt button.b{min-height:42px;padding-inline:16px;border-radius:64px;border:1px solid rgba(244,244,244,.35);background:none;color:#F4F4F4;font:700 14px/1 inherit;font-family:inherit;cursor:pointer}
.mwt button.b.go{border-color:#F4AF56;background:rgba(244,175,86,.14)}
.mwt button.b.clear{border-color:rgba(240,138,122,.45);color:#F7B2A6}
.mwt .busy{display:flex;align-items:center;gap:10px;color:#F4AF56;font-size:14.5px}
.mwt .busy i{width:16px;height:16px;border-radius:50%;border:2px solid currentColor;border-top-color:transparent;animation:mwtspin .8s linear infinite}
@keyframes mwtspin{to{transform:rotate(360deg)}}
.mwt small.pv{font-size:12px;color:rgba(244,244,244,.5)}
@media (max-width:620px){.mwt .row{grid-template-columns:1fr 1fr 1fr}.mwt .row .w2{grid-column:span 2}.mwt .rm{width:100%}}
`;

function pickFiles() {
  return new Promise(res => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png'; inp.multiple = true; inp.hidden = true;
    inp.onchange = () => { res([...(inp.files || [])]); inp.remove(); };
    inp.addEventListener('cancel', () => { res([]); inp.remove(); });
    document.body.appendChild(inp); inp.click();
  });
}

// open the sheet: read new tickets (if any), show existing + found flights to check, return the saved list (or null)
function open(opts = {}) {
  const w = words(), year = opts.year;
  if (!document.getElementById('mwt-css')) { const st = document.createElement('style'); st.id = 'mwt-css'; st.textContent = CSS; document.head.appendChild(st); }
  return new Promise(resolve => {
    let rows = (opts.rows || []).map(r => ({ ...r }));
    const v = document.createElement('div'); v.className = 'mwt'; v.dir = document.documentElement.dir || 'rtl';
    v.innerHTML = `<form novalidate><button type="button" class="x" aria-label="${esc(w.cancel)}">×</button><h2>${esc(w.title)}</h2>
      <p class="msg" role="status"></p><div class="rows"></div>
      <div class="acts"><button type="button" class="b" data-more>${esc(w.more)}</button><button type="button" class="b" data-add>${esc(w.add)}</button><span class="sp"></span>
        ${opts.rows && opts.rows.length ? `<button type="button" class="b clear" data-clear>${esc(w.clear)}</button>` : ''}
        <button type="submit" class="b go">${esc(w.save)}</button></div>
      <small class="pv">${esc(w.privacy)}</small></form>`;
    const f = v.querySelector('form'), list = v.querySelector('.rows'), msg = v.querySelector('.msg');
    const field = (r, k, label, type, cls = '') => `<label class="${cls}">${esc(label)}<input data-k="${k}" type="${type === 'time' ? 'text' : type}" value="${esc(r[k] || '')}"${k === 'from' || k === 'to' ? ' class="code" maxlength="3" dir="ltr"' : type === 'time' ? ' inputmode="numeric" maxlength="5" placeholder="00:00" dir="ltr"' : ' dir="ltr"'}></label>`;
    const draw = () => {
      list.innerHTML = rows.map((r, n) => `<div class="row" data-n="${n}">${field(r, 'iso', w.date, 'date', 'w2')}${field(r, 'time', w.dep, 'time')}${field(r, 'from', w.from, 'text')}${field(r, 'to', w.to, 'text')}${field(r, 'flight', w.no, 'text')}${field(r, 'arrive', w.arr, 'time')}
        <button type="button" class="rm" data-rm="${n}" aria-label="${esc(w.del)}">×</button></div>`).join('');
    };
    const read = () => { list.querySelectorAll('.row').forEach(el => { const r = rows[+el.dataset.n]; el.querySelectorAll('input').forEach(i => { r[i.dataset.k] = i.dataset.k === 'from' || i.dataset.k === 'to' || i.dataset.k === 'flight' ? i.value.trim().toUpperCase() : i.dataset.k === 'time' || i.dataset.k === 'arrive' ? hhmm(i.value) : i.value.trim(); }); }); };
    // "1655", "16.55", "7:20" → "16:55", "07:20"
    const hhmm = v => { const m = String(v).trim().match(/^(\d{1,2})\D?(\d{2})$/); return m && +m[1] < 24 && +m[2] < 60 ? `${m[1].padStart(2, '0')}:${m[2]}` : String(v).trim(); };
    const busy = on => { msg.className = 'msg'; msg.innerHTML = on ? `<span class="busy"><i></i>${esc(w.reading)}</span>` : ''; f.querySelectorAll('button').forEach(b => { b.disabled = on; }); };
    const addTickets = async files => {
      if (!files.length) return;
      if (!navigator.onLine) { msg.className = 'msg warn'; msg.textContent = w.offline; return; }
      busy(true); let found = [], failed = false;
      for (const file of files) { try { found = found.concat(parse(await textOf(file), { year })); } catch (e) { failed = true; } }
      busy(false); read();
      const key = r => (r.flight || r.from + r.to) + r.iso, have = new Set(rows.map(key));
      const fresh = found.filter(r => !have.has(key(r)));
      rows = rows.concat(fresh).sort((a, b) => (a.iso + a.time).localeCompare(b.iso + b.time));
      if (fresh.length) { msg.className = 'msg'; msg.textContent = w.found(fresh.length) + (fresh.some(r => !r.flight) ? ' ' + w.noNo : ''); }
      else { msg.className = 'msg warn'; msg.textContent = failed ? w.failed : w.none; if (!rows.length) rows.push({}); }
      draw();
    };
    const close = val => { v.remove(); resolve(val); };
    v.querySelector('.x').onclick = () => close(null);
    v.addEventListener('pointerdown', e => { if (e.target === v) close(null); });
    f.addEventListener('click', async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.rm != null) { read(); rows.splice(+b.dataset.rm, 1); draw(); }
      else if (b.hasAttribute('data-add')) { read(); rows.push({}); draw(); list.lastElementChild?.querySelector('input')?.focus(); }
      else if (b.hasAttribute('data-more')) { read(); addTickets(await pickFiles()); }
      else if (b.hasAttribute('data-clear')) { if (confirm(w.clearQ)) close([]); }
    });
    f.onsubmit = e => { e.preventDefault(); read(); close(rows.filter(r => r.iso && r.from && r.to).sort((a, b) => (a.iso + a.time).localeCompare(b.iso + b.time))); };
    draw(); document.body.appendChild(v);
    if (opts.files && opts.files.length) addTickets(opts.files);
  });
}

root.MWTickets = { parse, open, pickFiles, textOf };
if (typeof module !== 'undefined' && module.exports) module.exports = { parse, allDates };
})(typeof window !== 'undefined' ? window : globalThis);
