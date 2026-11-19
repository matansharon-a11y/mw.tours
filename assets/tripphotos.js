/* MW Photo Tours · trip photos: a floating + bubble where travelers drop all their photos
 *
 * Loaded by every expedition page, after members.js. A signed-in traveler picks any number of photos (JPEG, phone
 * photos or camera RAW). Each file goes from their device straight into Matan's Google Drive at full size, through
 * the Supabase Edge Function "trip-photos" (supabase/functions/trip-photos), which names and files them:
 *   <Tour> / <Subject> / <Traveler> / Name_Subject_DayN_Place_0001.ext   (unsure → <Tour> / Needs Review / <Traveler>)
 * On the device we work out what the server can't: the camera date and GPS (→ tour day and place, from the tour plan
 * the page exposes as window.MW_TRIP), a small preview, and what is in the photo (free image models running on the
 * device, see below; nothing is sent to an AI service). The photo itself is never changed.
 * Where: a floating + bubble on every tab (drag it anywhere, like AssistiveTouch), and "Add my trip photos" in the name menu.
 */
(() => {
const M = () => window.MWM;
if (window.MW_AS) return;                       // Matan's read-only traveler view: no sending

const RAW = /\.(cr2|cr3|crw|nef|nrw|arw|srf|sr2|raf|orf|rw2|dng|pef|srw|3fr|iiq|x3f|erf|mef|mos|kdc)$/i;
const isPhoto = f => /^image\//.test(f.type) || RAW.test(f.name) || /\.(heic|heif|jpe?g|png|tiff?|webp)$/i.test(f.name);
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const wait = ms => new Promise(r => setTimeout(r, ms));
const mb = n => n >= 1e9 ? (n / 1e9).toFixed(1) + ' GB' : Math.max(0.1, n / 1e6).toFixed(1) + ' MB';

const T = {
  he: { bubble: 'הוספת התמונות שלכם מהמסע', hint: 'כאן מוסיפים את התמונות שלכם מהמסע',
        lead: 'כמה שתרצו, בגודל מלא, גם קבצי RAW. אנחנו נמיין אותן אוטומטית לפי נושא, ונסמן בכל אחת את היום והמקום.',
        safe: 'התמונות שלכם מאובטחות.', safeText: 'הן עוברות בחיבור מוצפן ישר לארכיון התמונות הפרטי שלנו, בגודל המקורי. רק הצוות של MW Photo Tours רואה אותן, ואף אחד אחר במסע לא יכול לראות, לשנות או למחוק אותן.',
        menu: 'הוספת התמונות שלי מהמסע', title: 'זרקו לכאן את כל התמונות מהמסע', choose: 'בחירת תמונות', drop: 'או גררו לכאן תמונות',
        sentN: n => n === 1 ? 'שלחתם עד עכשיו תמונה אחת.' : `שלחתם עד עכשיו ${n} תמונות.`, none: 'עוד לא שלחתם תמונות.',
        of: (a, b) => `נשלחו ${a} מתוך ${b}`, left: s => `נשארו ${s}`, keepOpen: 'השאירו את העמוד פתוח עד שהכול נשלח.',
        allDone: 'הכול נשלח. תודה!', st: { wait: 'בתור', prep: 'מכינים', look: 'ממיינים', send: 'נשלחת', sent: 'נשלחה', already: 'כבר נשלחה', retry: 'מנסים שוב…', failed: 'לא נשלחה' },
        failedSome: n => `${n} לא נשלחו. בחרו אותן שוב כשיש קליטה, והן ימשיכו מאיפה שעצרו.`,
        skipped: n => n === 1 ? 'קובץ אחד דולג (לא תמונה).' : `${n} קבצים דולגו (לא תמונות).`,
        signIn: 'היכנסו קודם עם השם שלכם.', notReady: 'שליחת תמונות עוד לא הופעלה במסע הזה.', offline: 'אין חיבור כרגע. נסו שוב כשיש קליטה.',
        leave: 'התמונות עדיין נשלחות. לצאת בכל זאת?', firstSort: 'מכינים את המיון האוטומטי (הורדה חד־פעמית של כ-100MB, עדיף ב-Wi-Fi)…',
        close: 'סגירה', how: 'איך זה עובד', howText: 'כל תמונה נשמרת בגודל המקורי, מקבלת שם עם השם שלכם, היום והמקום, ונכנסת לתיקייה לפי מה שמופיע בה. המיון נעשה במכשיר שלכם, והתמונות לא נשלחות לשום שירות בינה מלאכותית.' },
  en: { bubble: 'Add your trip photos', hint: 'Add your trip photos here',
        lead: 'As many as you like, full size, RAW files too. We’ll sort them by subject automatically and label each one with the day and place.',
        safe: 'Your photos are secure.', safeText: 'They travel over an encrypted connection straight to our private photo archive, at full size. Only the MW Photo Tours team can see them, and no one else on the trip can view, change or delete them.',
        menu: 'Add my trip photos', title: 'Drop all your trip photos here', choose: 'Choose photos', drop: 'or drop photos here',
        sentN: n => n === 1 ? 'You’ve sent 1 photo so far.' : `You’ve sent ${n} photos so far.`, none: 'You haven’t sent any photos yet.',
        of: (a, b) => `${a} of ${b} sent`, left: s => `${s} to go`, keepOpen: 'Keep this page open until everything is sent.',
        allDone: 'All sent. Thank you!', st: { wait: 'Waiting', prep: 'Preparing', look: 'Sorting', send: 'Sending', sent: 'Sent', already: 'Already sent', retry: 'Trying again…', failed: 'Not sent' },
        failedSome: n => `${n} didn’t send. Choose them again when you have signal and they’ll continue where they stopped.`,
        skipped: n => n === 1 ? '1 file skipped (not a photo).' : `${n} files skipped (not photos).`,
        signIn: 'Sign in with your name first.', notReady: 'Photo sending isn’t switched on for this expedition yet.', offline: 'No connection right now. Try again when you have signal.',
        leave: 'Photos are still sending. Leave anyway?', firstSort: 'Getting the photo sorter ready (a one-time download of about 100 MB, best on Wi-Fi)…',
        close: 'Close', how: 'How it works', howText: 'Each photo is kept at its original size, named with your name, the day and the place, and put in a folder by what’s in it. The sorting happens on your device; photos aren’t sent to any AI service.' },
};
const W = () => T[(document.documentElement.lang || 'he').startsWith('en') ? 'en' : 'he'];

// ---------- the camera date and GPS (JPEG, TIFF-based RAW, and CR3's TIFF blocks) ----------
function exif(buf) {
  const v = new DataView(buf), u = new Uint8Array(buf), out = {};
  for (let i = 0; i + 8 < u.length && !(out.taken && out.lat != null); i++) {
    const le = u[i] === 0x49 && u[i + 1] === 0x49 && u[i + 2] === 0x2A && u[i + 3] === 0;
    const be = u[i] === 0x4D && u[i + 1] === 0x4D && u[i + 2] === 0 && u[i + 3] === 0x2A;
    if (le || be) { try { tiff(v, i, le, out); } catch (e) {} }
  }
  return out;
}
function tiff(v, base, le, out) {
  const g16 = o => v.getUint16(base + o, le), g32 = o => v.getUint32(base + o, le);
  const ifd = off => { const n = g16(off); if (!n || n > 400) throw 0; const t = {}; for (let k = 0; k < n; k++) { const e = off + 2 + k * 12; t[g16(e)] = { type: g16(e + 2), count: g32(e + 4), at: e + 8 }; } return t; };
  const str = t => { const at = t.count <= 4 ? t.at : g32(t.at); let s = ''; for (let k = 0; k < Math.min(t.count, 40); k++) { const c = v.getUint8(base + at + k); if (!c) break; s += String.fromCharCode(c); } return s; };
  const deg = t => { const at = g32(t.at), r = k => g32(at + k * 8) / (g32(at + k * 8 + 4) || 1); return r(0) + r(1) / 60 + r(2) / 3600; };
  const date = s => { const m = /^(\d{4}):(\d\d):(\d\d) (\d\d):(\d\d)/.exec(s || ''); return m && m[1] !== '0000' ? `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}` : null; };
  const gps = t => {
    if (!(t[2] && t[4] && t[2].type === 5 && t[2].count === 3 && t[4].type === 5)) return;
    let lat = deg(t[2]), lon = deg(t[4]);
    if (t[1] && str(t[1]) === 'S') lat = -lat; if (t[3] && str(t[3]) === 'W') lon = -lon;
    if ((lat || lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) { out.lat = lat; out.lon = lon; }
  };
  const t0 = ifd(g32(4));
  if (t0[0x9003] && t0[0x9003].type === 2) out.taken = date(str(t0[0x9003])) || out.taken;           // CR3: the Exif block on its own
  if (t0[0x8769]) { const ex = ifd(g32(t0[0x8769].at)); if (ex[0x9003]) out.taken = date(str(ex[0x9003])) || out.taken; }
  if (out.lat == null && t0[0x8825]) gps(ifd(g32(t0[0x8825].at)));
  if (out.lat == null && t0[1] && t0[1].type === 2) gps(t0);                                           // CR3: the GPS block on its own
  if (!out.taken && t0[0x0132] && t0[0x0132].type === 2) out.taken = date(str(t0[0x0132]));
}

// ---------- a small preview (for sorting and the Drive thumbnail; the photo itself is sent untouched) ----------
async function bitmapOf(file) {
  if (!RAW.test(file.name)) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image', resizeWidth: 1024, resizeQuality: 'medium' }); } catch (e) {}
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) {}
  }
  // RAW: use the JPEG the camera keeps inside the file (the biggest one that opens)
  try {
    const u = new Uint8Array(await file.slice(0, Math.min(file.size, 80e6)).arrayBuffer());
    const starts = [];
    for (let i = 0; i + 3 < u.length && starts.length < 12; i++)
      if (u[i] === 0xFF && u[i + 1] === 0xD8 && u[i + 2] === 0xFF && [0xDB, 0xE0, 0xE1, 0xC4, 0xC0, 0xEE].includes(u[i + 3])) starts.push(i);
    let best = null;
    for (const s of starts) {
      try {
        const b = await createImageBitmap(new Blob([u.subarray(s, Math.min(u.length, s + 30e6))], { type: 'image/jpeg' }));
        if (!best || b.width > best.width) { if (best) best.close(); best = b; } else b.close();
        if (best.width >= 1600) break;
      } catch (e) {}
    }
    return best;
  } catch (e) { return null; }
}
async function preview(file) {
  const b = await bitmapOf(file); if (!b) return null;
  const k = Math.min(1, 1024 / Math.max(b.width, b.height)), c = document.createElement('canvas');
  c.width = Math.round(b.width * k); c.height = Math.round(b.height * k);
  c.getContext('2d').drawImage(b, 0, 0, c.width, c.height); b.close && b.close();
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.82)); if (!blob) return null;
  const b64 = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(',')[1] || null); fr.onerror = () => r(null); fr.readAsDataURL(blob); });
  return { blob, b64 };
}

// ---------- what's in the photo: free image models running on this device, nothing sent to an AI service ----------
// 1. A small person finder (YOLOS-tiny, ~10 MB): a clear person in the photo → People & Group.
// 2. CLIP (~90 MB), in two steps, each comparing the photo with a few descriptions: first what kind of photo it is
//    (animal, landscape, night sky, food, other), then which one: this tour's species (its field cards) or the scene.
// When a step isn't clearly sure, the photo goes to Needs Review rather than a guess.
// CLIP's words' side is worked out ahead of time (assets/clip-labels.json), so devices download only its image side,
// once (kept by the browser). Words missing from that file load the words' side too (~65 MB, once per device).
const TF = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2/+esm';
const MODEL = 'Xenova/clip-vit-base-patch32', PEOPLE = 'Xenova/yolos-tiny';
const KIND = [
  ['people', ['a photo of people', 'a photo of a person', 'a portrait of a person', 'people standing in a landscape', 'a photographer with a camera']],
  ['animal', ['a photo of an animal', 'a photo of a bird', 'a wildlife photo']],
  ['landscape', ['a landscape photo', 'a photo of scenery']],
  ['night', ['a photo of the night sky']],
  ['food', ['a photo of food']],
  ['thing', ['a photo of a building', 'a photo of an object', 'a photo of a vehicle']],
];
const SCENE = [
  ['Mountains', ['a photo of mountains']], ['Lakes & Rivers', ['a photo of a lake', 'a photo of a river']],
  ['Glaciers & Ice', ['a photo of a glacier', 'a photo of ice']], ['Waterfalls', ['a photo of a waterfall']],
  ['Coast & Sea', ['a photo of the sea coast']], ['Forests', ['a photo of a forest']], ['Deserts', ['a photo of a desert']],
  ['Villages & Towns', ['a photo of a village']],
];
const NIGHT = [['Northern Lights', ['a photo of the northern lights', 'green aurora in the night sky']], ['Night Sky', ['a photo of stars in the night sky', 'the milky way']]];
const SURE = 0.5, GAP = 0.2;               // a step counts as sure from 50%, and (for species) 20 points ahead of the next
const PERSON = { score: 0.8, area: 0.03 }; // a person found with 80% and covering 3% of the photo or more
const LKEY = 'mw-clip-labels';
let clipP = null, cache = null, clipReady = false;
const unit = v => { let n = 0; for (const x of v) n += x * x; n = Math.sqrt(n) || 1; return Array.from(v, x => x / n); };
function clip() {
  if (!clipP) clipP = (async () => {
    const T = await import(TF);
    T.env.allowLocalModels = false;
    const [proc, vision, finder] = await Promise.all([
      T.AutoProcessor.from_pretrained(MODEL),
      T.CLIPVisionModelWithProjection.from_pretrained(MODEL, { dtype: 'q8' }),
      T.pipeline('object-detection', PEOPLE, { dtype: 'q8' }).catch(() => null),
    ]);
    clipReady = true;
    return { T, proc, vision, finder };
  })().catch(e => { clipP = null; throw e; });
  return clipP;
}
// the words' side for each description: ready-made file, then this device's own copies, then the model itself
async function labelVectors(prompts) {
  if (!cache) {
    cache = {};
    try { Object.assign(cache, await (await fetch('../assets/clip-labels.json?v=2')).json()); } catch (e) {}
    try { Object.assign(cache, JSON.parse(localStorage.getItem(LKEY) || '{}')); } catch (e) {}
  }
  const need = [...new Set(prompts.filter(p => !cache[p]))];
  if (need.length) {
    const { T } = await clip();
    const tok = await T.AutoTokenizer.from_pretrained(MODEL);
    const text = await T.CLIPTextModelWithProjection.from_pretrained(MODEL, { dtype: 'q8' });
    const { text_embeds } = await text(tok(need, { padding: true, truncation: true }));
    const d = text_embeds.dims[1], data = text_embeds.data, mine = {};
    need.forEach((p, i) => { cache[p] = mine[p] = unit(data.slice(i * d, (i + 1) * d)).map(x => +x.toFixed(5)); });
    try { localStorage.setItem(LKEY, JSON.stringify({ ...JSON.parse(localStorage.getItem(LKEY) || '{}'), ...mine })); } catch (e) {}
  }
  return prompts.map(p => cache[p]);
}
const speciesPrompts = n => [`a photo of a ${n.toLowerCase()}`, `a wildlife photo of a ${n.toLowerCase()}`];
const folderName = n => n.replace(/\b\w/g, c => c.toUpperCase()).replace(/\b(Of|And|The)\b/g, w => w.toLowerCase());
function animalLabels() {
  return [...((window.MW_TRIP || {}).animals || []).map(n => [folderName(n), speciesPrompts(n)]),
          ['Other Birds', ['a photo of a bird']], ['Other Animals', ['a photo of an animal']]];
}
// one comparison: the photo against a list of [name, [descriptions…]] → names ranked by chance
async function rank(L, v) {
  const vecs = await labelVectors(L.flatMap(l => l[1]));
  let k = 0;
  const lv = L.map(l => { const vs = l[1].map(() => vecs[k++]); return unit(vs[0].map((_, i) => vs.reduce((a, x) => a + x[i], 0))); });
  const lg = lv.map(t => 100 * t.reduce((a, x, i) => a + x * v[i], 0));
  const m = Math.max(...lg), ex = lg.map(x => Math.exp(x - m)), sum = ex.reduce((a, b) => a + b, 0);
  return L.map((l, i) => ({ name: l[0], p: ex[i] / sum })).sort((a, b) => b.p - a.p);
}
async function whatsIn(blob) {
  const { T, proc, vision, finder } = await clip();
  const img = await T.RawImage.fromBlob(blob);
  // 1. people
  if (finder) {
    try {
      const found = await finder(img, { threshold: 0.5, percentage: true });
      const p = found.filter(o => o.label === 'person' && o.score >= PERSON.score)
        .map(o => ({ s: o.score, a: (o.box.xmax - o.box.xmin) * (o.box.ymax - o.box.ymin) }))
        .sort((a, b) => b.a - a.a)[0];
      if (p && p.a >= PERSON.area) return { object: 'People & Group', confidence: +p.s.toFixed(3), note: `person found ${Math.round(p.s * 100)}%` };
    } catch (e) {}
  }
  // 2. what kind of photo, then which one
  const v = unit((await vision(await proc(img))).image_embeds.data);
  const kind = await rank(KIND, v), k = kind[0], kindSure = k.p >= SURE;
  let r = null, sure = kindSure, name;
  if (k.name === 'people') name = 'People & Group';
  else if (k.name === 'food') name = 'Food';
  else if (k.name === 'thing') name = 'Other';
  else {
    r = await rank(k.name === 'animal' ? animalLabels() : k.name === 'night' ? NIGHT : SCENE, v);
    name = r[0].name;
    sure = kindSure && r[0].p >= SURE && (k.name !== 'animal' || r[0].p - (r[1] ? r[1].p : 0) >= GAP);
  }
  const p = r ? r[0].p : k.p;
  const note = `${k.name} ${Math.round(k.p * 100)}%` + (r ? ' → ' + r.slice(0, 3).map(x => `${x.name} ${Math.round(x.p * 100)}%`).join(', ') : '');
  return { object: sure ? name : null, confidence: +p.toFixed(3), note };
}

// ---------- tour day and place, from the camera date / GPS and the tour plan ----------
function dayPlace(info) {
  const trip = window.MW_TRIP || {}, out = {};
  const date = info.taken ? info.taken.slice(0, 10) : null;
  const day = date && (trip.days || []).find(d => d.date === date);
  if (day) out.day = day.n;
  if (info.lat != null) {
    const rad = x => x * Math.PI / 180, km = (a, b) => {
      const dLat = rad(b[1] - a[1]), dLon = rad(b[0] - a[0]);
      const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
      return 12742 * Math.asin(Math.sqrt(h));
    };
    let best = null, bd = 40;                    // the nearest place on the tour map, within 40 km
    for (const p of trip.places || []) { const d = km([info.lon, info.lat], p.ll); if (d < bd) { bd = d; best = p.name; } }
    if (best) out.place = best;
  }
  if (!out.place && day && day.place) out.place = day.place;
  return out;
}

// ---------- talking to the Edge Function ----------
async function call(body) {
  const sb = await M().client();
  const { data, error } = await sb.functions.invoke('trip-photos', { body: { slug: M().slug, ...body } });
  if (!error) return data;
  let j = null; try { j = await error.context.json(); } catch (e) {}
  const err = new Error((j && j.error) || error.name || 'fail'); err.status = error.context && error.context.status; err.body = j;
  throw err;
}
// Google's resumable upload: send from byte `from`; true = finished, false = Google wants more
function put(url, file, from, onp) {
  return new Promise((res, rej) => {
    const x = new XMLHttpRequest(); x.open('PUT', url);
    if (from > 0) x.setRequestHeader('Content-Range', `bytes ${from}-${file.size - 1}/${file.size}`);
    x.upload.onprogress = e => onp(from + e.loaded);
    x.onload = () => x.status === 200 || x.status === 201 ? res(true) : x.status === 308 ? res(false) : rej(Object.assign(new Error('http'), { status: x.status }));
    x.onerror = () => rej(new Error('net'));
    x.send(from > 0 ? file.slice(from) : file);
  });
}
// how much Google already has: 'done', 'gone' (link expired) or the next byte to send
function probe(url, size) {
  return new Promise(res => {
    const x = new XMLHttpRequest(); x.open('PUT', url); x.setRequestHeader('Content-Range', `bytes */${size}`);
    x.onload = () => {
      if (x.status === 200 || x.status === 201) return res('done');
      if (x.status === 308) { const m = /bytes=0-(\d+)/.exec(x.getResponseHeader('Range') || ''); return res(m ? +m[1] + 1 : 0); }
      res(x.status === 404 || x.status === 410 ? 'gone' : 0);
    };
    x.onerror = () => res(null);
    x.send();
  });
}

// ---------- the queue ----------
const items = []; let running = 0, sentBefore = 0, sentKeys = new Set(), skipped = 0;
const ACTIVE = ['wait', 'prep', 'look', 'send', 'retry'];
const keyOf = f => `${f.name}|${f.size}`;
function add(files) {
  for (const f of files) {
    if (!isPhoto(f)) { skipped++; continue; }
    const key = keyOf(f), had = items.find(i => i.key === key);
    if (had) { if (had.state === 'failed') { had.state = 'wait'; had.file = f; } continue; }
    items.push({ file: f, key, state: sentKeys.has(key) ? 'already' : 'wait', done: 0 });
  }
  draw(); pump();
}
function pump() {
  while (running < 2) {
    const it = items.find(i => i.state === 'wait'); if (!it) break;
    running++; it.state = 'prep'; draw();
    one(it).catch(e => { it.state = 'failed'; it.err = e; }).finally(() => { running--; draw(); pump(); });
  }
}
async function one(it) {
  const f = it.file, hints = ((window.MW_TRIP || {}).animals || []).join(', ');
  let info = {}; try { info = exif(await f.slice(0, 1 << 20).arrayBuffer()); } catch (e) {}
  const where = dayPlace(info), pv = await preview(f).catch(() => null);
  let ai = null;
  if (pv) { it.state = 'look'; draw(); try { ai = await whatsIn(pv.blob); } catch (e) { ai = null; } }
  const base = { key: it.key, name: f.name, mime: f.type || (RAW.test(f.name) ? 'image/x-raw' : 'application/octet-stream'), size: f.size,
                 taken: info.taken || null, day: where.day ?? null, place: where.place || null, hints,
                 object: ai && ai.object, confidence: ai ? ai.confidence : null, note: ai ? ai.note : null };
  let r = await call({ action: 'start', ...base, preview: pv && pv.b64 });
  if (r.status !== 'started') { it.state = 'already'; sentKeys.add(it.key); return; }
  it.state = 'send'; draw();
  let url = r.upload_url, from = 0;
  const fresh = async () => { r = await call({ action: 'start', ...base, preview: pv && pv.b64, fresh: true }); url = r.upload_url; return 0; };
  if (r.resume) { const p = await probe(url, f.size); if (p === 'gone') from = await fresh(); else if (p !== 'done') from = p || 0; else from = -1; }
  for (let tries = 0; from >= 0; tries++) {
    try {
      if (await put(url, f, from, n => { it.done = n; drawSoon(); })) break;
      const p = await probe(url, f.size); if (p === 'done') break; from = typeof p === 'number' ? p : 0;
    } catch (e) {
      if (tries >= 6) throw e;
      it.state = 'retry'; draw(); await wait(Math.min(30000, 2000 * 2 ** tries));
      while (!navigator.onLine) await wait(3000);
      const p = await probe(url, f.size);
      if (p === 'done') break; if (p === 'gone') from = await fresh(); else from = typeof p === 'number' ? p : 0;
      it.state = 'send'; draw();
    }
  }
  it.done = f.size;
  for (let k = 0; ; k++) {                       // tell the server; Google may need a moment to show the file
    try { await call({ action: 'done', id: r.id }); break; }
    catch (e) { if (k >= 4) throw e; await wait(2500 * (k + 1)); }
  }
  it.state = 'sent'; sentKeys.add(it.key);
}
addEventListener('beforeunload', e => { if (items.some(i => ACTIVE.includes(i.state))) { e.preventDefault(); e.returnValue = W().leave; } });

// ---------- the sheet ----------
const css = `
.mw-tp{position:fixed;inset:0;z-index:90;display:grid;place-items:end center;background:rgba(5,5,4,.62);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);font-family:var(--sans,inherit)}
@media (min-width:700px){.mw-tp{place-items:center}}
.mw-tp .tp-sh{width:min(560px,100%);max-height:min(88vh,760px);overflow:auto;padding:22px 20px calc(20px + env(safe-area-inset-bottom));border-radius:22px 22px 0 0;background:#12100E;border:1px solid rgba(254,251,241,.14);color:#F4F4F4;box-shadow:0 30px 80px rgba(0,0,0,.6)}
@media (min-width:700px){.mw-tp .tp-sh{border-radius:22px}}
.mw-tp .tp-hd{display:flex;align-items:flex-start;gap:12px}.mw-tp h3{flex:1;margin:0;font-size:21px;line-height:1.25;color:#FEFBF1}
.mw-tp .tp-x{flex:none;width:36px;height:36px;border-radius:50%;border:1px solid rgba(254,251,241,.2);background:none;color:#FEFBF1;font-size:20px;line-height:1;cursor:pointer}
.mw-tp p{margin:8px 0 0;font-size:14px;line-height:1.55;color:rgba(244,244,244,.78)}
.mw-tp .tp-dz{margin-top:16px;display:grid;justify-items:center;gap:8px;padding:22px 14px;border-radius:16px;border:1.5px dashed rgba(232,162,62,.45);background:rgba(232,162,62,.06);text-align:center}
.mw-tp .tp-dz.tp-on{background:rgba(232,162,62,.16);border-color:#E8A23E}
.mw-tp .tp-pick{min-height:46px;padding:0 24px;border-radius:64px;border:0;background:linear-gradient(135deg,#F4AF56,#B9875F);color:#0A0908;font:700 15px/1 inherit;font-family:inherit;cursor:pointer}
.mw-tp .tp-dz small{font-size:12.5px;color:rgba(244,244,244,.6)}
.mw-tp .tp-sum{margin-top:16px;font-size:14px;color:#FEFBF1}.mw-tp .tp-sum b{color:#F4AF56}
.mw-tp .tp-bar{height:6px;margin-top:8px;border-radius:6px;background:rgba(254,251,241,.12);overflow:hidden}.mw-tp .tp-bar i{display:block;height:100%;background:linear-gradient(90deg,#F4AF56,#E8A23E);transition:width .3s}
.mw-tp .tp-note{font-size:12.5px;color:rgba(244,244,244,.62)}.mw-tp .tp-warn{color:#F7B2A6}
.mw-tp ul{list-style:none;margin:12px 0 0;padding:0;display:grid;gap:2px}
.mw-tp li{display:flex;gap:10px;align-items:center;padding:7px 0;border-bottom:1px solid rgba(254,251,241,.07);font-size:13px}
.mw-tp li span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;direction:ltr;text-align:start}
.mw-tp li em{flex:none;font-style:normal;font-size:12px;color:rgba(244,244,244,.6)}.mw-tp li.sent em,.mw-tp li.already em{color:#A9C48C}.mw-tp li.failed em{color:#F7B2A6}
.mw-tp details{margin-top:14px;font-size:13px;color:rgba(244,244,244,.7)}.mw-tp summary{cursor:pointer;color:#FEFBF1}
.mw-tp .tp-safe{display:flex;gap:10px;align-items:flex-start;margin-top:14px;padding:12px 14px;border-radius:14px;background:rgba(169,196,140,.09);border:1px solid rgba(169,196,140,.28)}
.mw-tp .tp-safe svg{flex:none;width:20px;height:20px;margin-top:2px;color:#A9C48C}.mw-tp .tp-safe p{margin:0;font-size:13px;line-height:1.5}.mw-tp .tp-safe b{color:#FEFBF1}
#mw-tpb{position:fixed;z-index:85;left:0;top:0;width:58px;height:58px;border-radius:50%;border:0;padding:0;display:grid;place-items:center;cursor:grab;touch-action:none;user-select:none;-webkit-user-select:none;
  background:radial-gradient(120% 120% at 30% 25%,#FFD08A 0,#F4AF56 45%,#B9875F 100%);color:#0A0908;box-shadow:0 10px 28px rgba(0,0,0,.45),0 0 0 6px rgba(244,175,86,.16);transition:opacity .2s,transform .2s var(--spring,ease)}
.journeying #mw-tpb,.journeying #mw-tpb-hint{opacity:0;pointer-events:none}
#mw-tpb svg{width:28px;height:28px;pointer-events:none}#mw-tpb.drag{cursor:grabbing;transform:scale(1.08);transition:opacity .2s}#mw-tpb.dim{opacity:.55}
#mw-tpb i{position:absolute;top:-4px;inset-inline-end:-4px;min-width:20px;height:20px;padding:0 5px;border-radius:10px;background:#12100E;color:#F4AF56;border:1.5px solid #F4AF56;font:700 11px/17px var(--sans,inherit);font-style:normal;text-align:center}
#mw-tpb-hint{position:fixed;z-index:85;max-width:200px;padding:9px 12px;border-radius:12px;background:rgba(16,14,12,.96);border:1px solid rgba(244,175,86,.4);color:#FEFBF1;font:600 13px/1.35 var(--sans,inherit);box-shadow:0 10px 28px rgba(0,0,0,.4);pointer-events:none}
#mw-whopop .mw-tpmenu{border-color:rgba(232,162,62,.5);color:#F4AF56}
`;
let sheet = null, input = null, drawT = 0;
const drawSoon = () => { if (!drawT) drawT = setTimeout(() => { drawT = 0; draw(); }, 250); };
function open() {
  const m = M(); if (!m) return;
  if (!m.member()) { alert(W().signIn); return; }
  if (!sheet) {
    sheet = document.createElement('div'); sheet.className = 'mw-tp'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true');
    sheet.addEventListener('click', e => {
      if (e.target === sheet || e.target.closest('.tp-x')) close();
      if (e.target.closest('.tp-pick')) input.click();
    });
    input = document.createElement('input'); input.type = 'file'; input.multiple = true; input.hidden = true;
    input.accept = 'image/*,.cr2,.cr3,.crw,.nef,.nrw,.arw,.srf,.sr2,.raf,.orf,.rw2,.dng,.pef,.srw,.3fr,.iiq,.x3f,.erf,.heic,.heif,.tif,.tiff';
    input.onchange = () => { add([...input.files]); input.value = ''; };
    document.body.appendChild(input);
    sheet.addEventListener('dragover', e => { e.preventDefault(); sheet.querySelector('.tp-dz')?.classList.add('tp-on'); });
    sheet.addEventListener('dragleave', e => { if (e.target.classList?.contains('tp-dz')) e.target.classList.remove('tp-on'); });
    sheet.addEventListener('drop', e => { e.preventDefault(); sheet.querySelector('.tp-dz')?.classList.remove('tp-on'); add([...(e.dataTransfer?.files || [])]); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && sheet.isConnected) close(); });
  }
  hideHint(); document.body.appendChild(sheet); draw();
  refreshMine();
}
function close() { sheet && sheet.remove(); bubble(); }
async function refreshMine() {
  try {
    const sb = await M().client();
    const { data, error } = await sb.rpc('my_trip_photos', { p_slug: M().slug });
    if (error) throw error;
    sentBefore = data.sent || 0; (data.keys || []).forEach(k => sentKeys.add(k));
    items.forEach(i => { if (i.state === 'wait' && sentKeys.has(i.key)) i.state = 'already'; });
    draw();
  } catch (e) { if (!navigator.onLine) { sentBefore = -1; draw(); } }
}
function draw() {
  if (bub) bubble();
  if (!sheet || !sheet.isConnected) return;
  const w = W(), dir = document.documentElement.dir || 'rtl';
  const total = items.length, done = items.filter(i => i.state === 'sent' || i.state === 'already').length;
  const failed = items.filter(i => i.state === 'failed').length, active = items.some(i => ACTIVE.includes(i.state));
  const bytes = items.reduce((a, i) => a + i.file.size, 0), got = items.reduce((a, i) => a + (i.state === 'sent' || i.state === 'already' ? i.file.size : i.done || 0), 0);
  const nowSent = items.filter(i => i.state === 'sent').length;
  const mine = sentBefore < 0 ? `<p class="tp-note tp-warn">${esc(w.offline)}</p>` : `<p class="tp-note">${esc(sentBefore + nowSent ? w.sentN(sentBefore + nowSent) : w.none)}</p>`;
  const list = items.slice(-60).reverse().map(i => `<li class="${i.state}"><span>${esc(i.file.name)} · ${mb(i.file.size)}</span><em>${esc(w.st[i.state])}${i.state === 'send' && i.done ? ' ' + Math.floor(100 * i.done / i.file.size) + '%' : ''}</em></li>`).join('');
  sheet.dir = dir;
  sheet.innerHTML = `<div class="tp-sh">
    <div class="tp-hd"><h3>${esc(w.title)}</h3><button class="tp-x" type="button" aria-label="${esc(w.close)}">×</button></div>
    <p>${esc(w.lead)}</p>
    <div class="tp-safe">${LOCK}<p><b>${esc(w.safe)}</b> ${esc(w.safeText)}</p></div>
    <div class="tp-dz"><button class="tp-pick" type="button">${esc(w.choose)}</button><small>${esc(w.drop)}</small></div>
    ${total ? `<div class="tp-sum">${esc(w.of(done, total))}${active ? ` · ${esc(w.left(mb(Math.max(0, bytes - got))))}` : ''}${!active && !failed ? ` · <b>${esc(w.allDone)}</b>` : ''}</div>
      <div class="tp-bar"><i style="width:${bytes ? Math.round(100 * got / bytes) : 0}%"></i></div>
      ${active ? `<p class="tp-note">${esc(w.keepOpen)}</p>` : ''}${!clipReady && items.some(i => i.state === 'look') ? `<p class="tp-note">${esc(w.firstSort)}</p>` : ''}
      ${failed ? `<p class="tp-note tp-warn">${esc(w.failedSome(failed))}</p>` : ''}
      ${skipped ? `<p class="tp-note">${esc(w.skipped(skipped))}</p>` : ''}` : mine}
    ${total ? mine : ''}
    ${list ? `<ul>${list}</ul>` : ''}
    <details><summary>${esc(w.how)}</summary><p>${esc(w.howText)}</p></details>
  </div>`;
  const err = items.find(i => i.state === 'failed' && i.err && /not_member|sign_in/.test(i.err.message));
  if (err) sheet.querySelector('.tp-sh').insertAdjacentHTML('beforeend', `<p class="tp-note tp-warn">${esc(w.signIn)}</p>`);
  const off = items.find(i => i.state === 'failed' && i.err && (i.err.status === 404 || /FunctionsFetchError|FunctionsRelayError/.test(i.err.message)));
  if (off && !err) sheet.querySelector('.tp-sh').insertAdjacentHTML('beforeend', `<p class="tp-note tp-warn">${esc(navigator.onLine ? w.notReady : w.offline)}</p>`);
}

// ---------- where it shows: a floating + bubble on every tab, and the name menu ----------
// shown only once the Drive setup is done (the function says so); remembered for offline
const READY = 'mw-tripphotos-ready';
let ready = (() => { try { return localStorage.getItem(READY) === '1'; } catch (e) { return false; } })(), asked = false;
async function check() {
  if (asked || !M() || !M().member()) return; asked = true;
  try {
    const r = await call({ action: 'ping' }); ready = !!(r && r.ready);
    try { ready ? localStorage.setItem(READY, '1') : localStorage.removeItem(READY); } catch (e) {}
    bubble();
  } catch (e) { setTimeout(() => { asked = false; }, 300000); }   // not reachable: ask again in 5 minutes
}
const LOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg>';
const PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
// a floating + bubble on every tab (like AssistiveTouch): drag it anywhere, it settles against the nearest side
const POS = 'mw-tpb-pos', HINTED = 'mw-tpb-hinted';
let bub = null;
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
function edges() {
  const bar = (document.querySelector('.tabs')?.getBoundingClientRect().height || 64), top = (document.querySelector('.top')?.getBoundingClientRect().bottom || 56);
  return { minY: top + 10, maxY: innerHeight - bar - 58 - 14, maxX: innerWidth - 58 - 10 };
}
function place(x, y, snap) {
  const e = edges();
  if (snap) x = x + 29 < innerWidth / 2 ? 10 : e.maxX;
  x = Math.max(10, Math.min(e.maxX, x)); y = Math.max(e.minY, Math.min(e.maxY, y));
  bub.style.transform = `translate(${x}px,${y}px)`; bub.dataset.x = x; bub.dataset.y = y;
  return { x, y };
}
function bubble() {
  const m = M(), show = m && m.member() && ready && !(document.getElementById('gate')?.offsetWidth);
  if (!show) { if (bub) { bub.remove(); bub = null; } return; }
  const w = W();
  if (!bub) {
    bub = document.createElement('button'); bub.id = 'mw-tpb'; bub.type = 'button'; bub.innerHTML = PLUS + '<i hidden></i>';
    document.body.appendChild(bub);
    let saved = null; try { saved = JSON.parse(lsGet(POS) || 'null'); } catch (e) {}
    const start = saved ? { x: saved.side === 'l' ? 10 : innerWidth, y: saved.f * innerHeight } : { x: innerWidth, y: innerHeight * 0.62 };
    place(start.x, start.y, true);
    let down = null, moved = false;
    bub.addEventListener('pointerdown', e => { down = { px: e.clientX, py: e.clientY, x: +bub.dataset.x, y: +bub.dataset.y }; moved = false; bub.setPointerCapture(e.pointerId); });
    bub.addEventListener('pointermove', e => {
      if (!down) return; const dx = e.clientX - down.px, dy = e.clientY - down.py;
      if (!moved && Math.hypot(dx, dy) < 6) return;
      moved = true; bub.classList.add('drag'); place(down.x + dx, down.y + dy, false); hideHint();
    });
    const up = () => {
      if (!down) return; down = null; bub.classList.remove('drag');
      if (moved) { const p = place(+bub.dataset.x, +bub.dataset.y, true); lsSet(POS, JSON.stringify({ side: p.x < innerWidth / 2 ? 'l' : 'r', f: p.y / innerHeight })); }
      else open();
    };
    bub.addEventListener('pointerup', up); bub.addEventListener('pointercancel', up);
    addEventListener('resize', () => bub && place(+bub.dataset.x, +bub.dataset.y, true));
    if (!lsGet(HINTED)) setTimeout(showHint, 1200);
  }
  bub.setAttribute('aria-label', w.bubble); bub.title = w.bubble;
  const left = items.filter(i => ACTIVE.includes(i.state)).length, badge = bub.querySelector('i');
  badge.hidden = !left; badge.textContent = left;
  bub.classList.toggle('dim', !!(sheet && sheet.isConnected));
}
// once per device: a small label beside the bubble
let hintEl = null;
function showHint() {
  if (!bub || hintEl) return; lsSet(HINTED, '1');
  hintEl = document.createElement('div'); hintEl.id = 'mw-tpb-hint'; hintEl.textContent = W().hint; hintEl.dir = document.documentElement.dir || 'rtl';
  document.body.appendChild(hintEl);
  const x = +bub.dataset.x, y = +bub.dataset.y, r = hintEl.getBoundingClientRect();
  hintEl.style.left = (x < innerWidth / 2 ? x + 68 : x - r.width - 10) + 'px'; hintEl.style.top = (y + 29 - r.height / 2) + 'px';
  setTimeout(hideHint, 5000);
}
function hideHint() { if (hintEl) { hintEl.remove(); hintEl = null; } }
function menu(pop) {
  if (!ready || pop.querySelector('.mw-tpmenu')) return;
  const b = document.createElement('button'); b.type = 'button'; b.className = 'mw-tpmenu'; b.textContent = W().menu;
  b.onclick = e => { e.stopPropagation(); pop.remove(); open(); };
  const out = pop.querySelector('button'); pop.insertBefore(b, out || null);
}
function boot() {
  if (!M()) return setTimeout(boot, 300);
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  new MutationObserver(muts => { for (const m of muts) for (const n of m.addedNodes) if (n.id === 'mw-whopop') menu(n); }).observe(document.body, { childList: true });
  new MutationObserver(() => { bubble(); draw(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  setInterval(() => { if (!ready) check(); bubble(); }, 1500);   // after joining, the bubble appears without a reload
  check(); bubble();
}
window.MWTripPhotos = { open };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
