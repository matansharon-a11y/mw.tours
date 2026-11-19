// MW Photo Tours · trip photos → Google Drive, sorted by subject.
// What's in each photo is worked out on the traveler's own device by free image models (assets/tripphotos.js);
// nothing is sent to an AI service. This function only stores, names and files the photos in Drive.
// Supabase Edge Function "trip-photos". Deploy: Supabase → Edge Functions → trip-photos → Code → paste this file → Deploy.
// Database part: supabase-update-trip-photos.txt.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN   Google access to the Drive (OAuth client "Trip photos
//                                                                  uploader" in Google Cloud project mwp-trip-photos, scope drive)
//   DRIVE_FOLDER_ID                                                the "MWP Trip Photos" Shared Drive everything goes in
//
// Actions (POST JSON):
//   {action:'start', slug, key, name, mime, size, taken, day, place, hints, preview, object, confidence, note}
//        a traveler starts sending one photo (object = the folder the device chose, or empty when it wasn't sure).
//        Returns {id, status, upload_url}: the browser then sends the file itself straight to Google (full size).
//   {action:'done', id}    the browser finished sending; the file joins the filing queue.
//   {action:'sort'}        the filing job (every minute from pg_cron, and right after 'done').
//   {action:'ping'}        {ready}: are all the secrets set. Until then the tour pages don't show "Send photos".
//
// Where photos go:  <Tour Year> / Incoming        while waiting to be filed (a minute or two)
//                   <Tour Year> / <Subject> / <Traveler> / Traveler_Subject_DayN_Place_0001.ext
//                   <Tour Year> / Needs Review / <Traveler> /  when the device wasn't sure (never a guess)
// Nothing is ever deleted or overwritten in Drive: every file has its own number, and the job only renames and moves.

import { createClient } from "npm:@supabase/supabase-js@2.119.1";

const env = (k: string) => Deno.env.get(k) ?? "";
const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const ORIGINS = ["https://tours.mw.photography", "http://localhost:8000", "http://127.0.0.1:8000"];
const SITE = "https://tours.mw.photography";
const BATCH = 10, AT_ONCE = 5;   // photos per run of the filing job, and how many at once

const cors = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && ORIGINS.includes(origin) ? origin : SITE,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
});
const json = (body: unknown, status: number, origin: string | null) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(origin), "Content-Type": "application/json" } });

// ---------- Google Drive ----------
let token = "", tokenUntil = 0;
async function google(): Promise<string> {
  if (token && Date.now() < tokenUntil) return token;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env("GOOGLE_CLIENT_ID"), client_secret: env("GOOGLE_CLIENT_SECRET"),
      refresh_token: env("GOOGLE_REFRESH_TOKEN"), grant_type: "refresh_token",
    }),
  });
  const d = await r.json();
  if (!r.ok || !d.access_token) throw new Error("google_auth: " + (d.error_description || d.error || r.status));
  token = d.access_token; tokenUntil = Date.now() + (d.expires_in - 120) * 1000;
  return token;
}
async function drive(path: string, init: RequestInit = {}, upload = false) {
  const base = upload ? "https://www.googleapis.com/upload/drive/v3/" : "https://www.googleapis.com/drive/v3/";
  const sep = path.includes("?") ? "&" : "?";
  const r = await fetch(base + path + sep + "supportsAllDrives=true", {
    ...init, headers: { Authorization: "Bearer " + await google(), ...(init.headers || {}) },
  });
  if (!r.ok) throw new Error(`drive ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return r;
}
const q = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

// tour folder name, e.g. "Iceland Northern Lights 2026" (from the site's tour list)
let tourList: Record<string, string> | null = null;
async function tourName(slug: string) {
  if (!tourList) {
    tourList = {};
    try {
      const d = await (await fetch(SITE + "/tours.json")).json();
      for (const t of d.tours || []) tourList[t.slug] = `${t.title?.en || t.slug} ${String(t.start || "").slice(0, 4)}`.trim();
    } catch (_) { /* fall back to the slug */ }
  }
  return tourList[slug] || slug;
}

// a folder under the tour folder ('' = the tour folder itself), made once and remembered
const making = new Map<string, Promise<string>>();     // one creation at a time per folder
function folder(slug: string, path: string): Promise<string> {
  const k = slug + "|" + path;
  if (!making.has(k)) making.set(k, makeFolder(slug, path).catch((e) => { making.delete(k); throw e; }));
  return making.get(k)!;
}
async function makeFolder(slug: string, path: string): Promise<string> {
  const { data } = await db.from("trip_photo_folders").select("folder_id").eq("tour_slug", slug).eq("path", path).maybeSingle();
  if (data) return data.folder_id;
  const parts = path ? path.split("/") : [];
  const parent = parts.length ? await folder(slug, parts.slice(0, -1).join("/")) : env("DRIVE_FOLDER_ID");
  const name = parts.length ? parts[parts.length - 1] : await tourName(slug);
  const found = await (await drive("files?" + new URLSearchParams({
    q: `name = '${q(name)}' and '${parent}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id)", includeItemsFromAllDrives: "true", corpora: "allDrives",
  }))).json();
  let id = found.files?.[0]?.id;
  if (!id) {
    const made = await (await drive("files?fields=id", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", parents: [parent] }),
    })).json();
    id = made.id;
  }
  await db.from("trip_photo_folders").upsert({ tour_slug: slug, path, folder_id: id });
  return id;
}

// ---------- names ----------
// "Jökulsárlón lagoon" → "JokulsarlonLagoon"; Hebrew letters are kept as they are
const compact = (s: string | null | undefined) => String(s || "")
  .normalize("NFD").replace(/\p{M}/gu, "")
  .split(/[^\p{L}\p{N}]+/u).filter(Boolean)
  .map((w) => w[0].toUpperCase() + w.slice(1)).join("").slice(0, 40);
const folderSafe = (s: string) => s.replace(/[\/\\:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
const pad = (n: number) => String(n).padStart(4, "0");
function fileName(r: Row, object: string | null) {
  const parts = [compact(r.uploader), object ? compact(object) : "", r.day ? `Day${r.day}` : "", compact(r.place), pad(r.seq)];
  return parts.filter(Boolean).join("_") + "." + r.ext;
}

type Row = {
  id: string; tour_slug: string; member_id: string; uploader: string; seq: number; ext: string; orig_name: string;
  mime: string | null; size: number; taken: string | null; day: number | null; place: string | null;
  session_url: string | null; drive_id: string | null; status: string; tries: number;
  object: string | null; confidence: number | null; ai_note: string | null;
};

async function userOf(req: Request) {
  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const { data } = await db.auth.getUser(jwt);
  return data?.user || null;
}

// ---------- start: a traveler sends one photo ----------
async function start(req: Request, body: any, origin: string | null) {
  const user = await userOf(req);
  if (!user) return json({ error: "sign_in" }, 401, origin);
  const size = Number(body.size), name = String(body.name || "photo").slice(0, 200);
  if (!body.slug || !body.key || !(size > 0) || size > 2_000_000_000) return json({ error: "bad_request" }, 400, origin);
  const ext = (name.match(/\.([A-Za-z0-9]{1,10})$/)?.[1] || "jpg").toLowerCase();

  const { data: row, error } = await db.rpc("trip_photo_claim", {
    p_user: user.id, p_slug: body.slug, p_key: String(body.key).slice(0, 300), p_name: name,
    p_mime: body.mime || "application/octet-stream", p_size: size, p_ext: ext,
    p_taken: body.taken || null, p_day: Number.isInteger(body.day) ? body.day : null,
    p_place: body.place || null, p_hints: body.hints || null,
  });
  if (error) return json({ error: /not_member/.test(error.message) ? "not_member" : "db" }, /not_member/.test(error.message) ? 403 : 500, origin);
  const r = row as Row;
  if (r.status !== "started") return json({ id: r.id, status: r.status }, 200, origin);   // already sent earlier
  if (r.session_url && !body.fresh) return json({ id: r.id, status: r.status, upload_url: r.session_url, resume: true }, 200, origin);

  // what the traveler's device saw in the photo (a folder name only when it was sure)
  if (!r.session_url) {
    const object = typeof body.object === "string" && body.object.trim() ? folderSafe(body.object) : null;
    const conf = Number(body.confidence);
    await db.from("trip_photos").update({
      object, confidence: Number.isFinite(conf) ? conf : null, ai_note: body.note ? String(body.note).slice(0, 300) : null,
    }).eq("id", r.id);
  }

  // a Google upload link for this one file; the browser sends the bytes straight to Google
  const meta: Record<string, unknown> = {
    name: fileName(r, null), parents: [await folder(r.tour_slug, "Incoming")],
    description: `Sent by ${r.uploader} from tours.mw.photography · original name ${r.orig_name}`,
    appProperties: { mw: r.id },
  };
  // the small preview becomes the Drive thumbnail (useful for RAW files Drive can't preview)
  if (typeof body.preview === "string" && body.preview.length < 1_300_000) {
    meta.contentHints = { thumbnail: { image: body.preview.replace(/\+/g, "-").replace(/\//g, "_"), mimeType: "image/jpeg" } };
  }
  const res = await drive("files?uploadType=resumable", {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": r.mime || "application/octet-stream",
      "X-Upload-Content-Length": String(r.size),
      ...(origin && ORIGINS.includes(origin) ? { Origin: origin } : {}),
    },
    body: JSON.stringify(meta),
  }, true);
  const url = res.headers.get("location");
  if (!url) return json({ error: "drive" }, 502, origin);
  await db.from("trip_photos").update({ session_url: url }).eq("id", r.id);
  return json({ id: r.id, status: "started", upload_url: url }, 200, origin);
}

// ---------- done: the file is in Drive ----------
async function done(req: Request, body: any, origin: string | null) {
  const user = await userOf(req);
  if (!user) return json({ error: "sign_in" }, 401, origin);
  const { data: r } = await db.from("trip_photos").select("*").eq("id", body.id).maybeSingle();
  if (!r) return json({ error: "missing" }, 404, origin);
  const { data: link } = await db.from("member_devices").select("member_id").eq("user_id", user.id).eq("member_id", r.member_id).maybeSingle();
  if (!link) return json({ error: "not_yours" }, 403, origin);
  if (r.status !== "started") return json({ id: r.id, status: r.status }, 200, origin);

  // find the file by its tag (the browser's word is not enough) and check it arrived whole
  const found = await (await drive("files?" + new URLSearchParams({
    q: `appProperties has { key='mw' and value='${r.id}' } and trashed = false`,
    fields: "files(id,size)", includeItemsFromAllDrives: "true", corpora: "allDrives",
  }))).json();
  const f = (found.files || []).find((x: any) => Number(x.size) === Number(r.size));
  if (!f) return json({ id: r.id, status: "started", error: "not_complete" }, 409, origin);
  await db.from("trip_photos").update({ status: "uploaded", drive_id: f.id, uploaded_at: new Date().toISOString(), session_url: null }).eq("id", r.id);
  // @ts-ignore EdgeRuntime is there on Supabase
  try { EdgeRuntime.waitUntil(sortSome()); } catch (_) { /* the minute job will do it */ }
  return json({ id: r.id, status: "uploaded" }, 200, origin);
}

// ---------- file: rename the photo and move it to its folder ----------
async function sortOne(r: Row, existing: string[]) {
  try {
    let object = r.object ? folderSafe(r.object) : null;
    if (object) {
      const same = existing.find((e) => e.toLowerCase() === object!.toLowerCase());
      if (same) object = same; else existing.push(object);
    }
    const path = object ? `${object}/${folderSafe(r.uploader)}` : `Needs Review/${folderSafe(r.uploader)}`;
    const target = await folder(r.tour_slug, path);
    const inbox = await folder(r.tour_slug, "Incoming");
    const name = fileName(r, object);
    const desc = [
      `By ${r.uploader}`, r.day ? `Day ${r.day}` : "", r.place || "", r.taken ? `camera time ${r.taken}` : "",
      `original name ${r.orig_name}`,
      r.ai_note ? `${object ? "sorted automatically" : "not sure, best matches"}: ${r.ai_note}` : "couldn't be checked automatically",
    ].filter(Boolean).join(" · ");
    await drive(`files/${r.drive_id}?addParents=${target}&removeParents=${inbox}&fields=id`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description: desc }),
    });
    await db.from("trip_photos").update({
      status: object ? "sorted" : "review", object, final_name: name, sorted_at: new Date().toISOString(), error: null,
    }).eq("id", r.id);
  } catch (e) {
    // try again on the next run; after 5 tries it stops and stays in Incoming, with the error on the row
    await db.from("trip_photos").update({ status: r.tries >= 5 ? "review" : "uploaded", error: String((e as Error)?.message || e).slice(0, 300) }).eq("id", r.id);
  }
}

async function sortSome() {
  const { data: rows } = await db.rpc("trip_photo_lease", { p_n: BATCH });
  if (!rows?.length) return 0;
  const list = rows as Row[];
  const bySlug: Record<string, string[]> = {};
  for (const slug of new Set(list.map((r) => r.tour_slug))) {
    const { data } = await db.from("trip_photos").select("object").eq("tour_slug", slug).eq("status", "sorted").not("object", "is", null);
    bySlug[slug] = [...new Set((data || []).map((x: any) => x.object as string))].sort();
  }
  for (let i = 0; i < list.length; i += AT_ONCE) {
    await Promise.all(list.slice(i, i + AT_ONCE).map((r) => sortOne(r, bySlug[r.tour_slug])));
  }
  return list.length;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return json({ error: "method" }, 405, origin);
  let body: any = {};
  try { body = await req.json(); } catch (_) { return json({ error: "bad_request" }, 400, origin); }
  try {
    if (body.action === "start") return await start(req, body, origin);
    if (body.action === "done") return await done(req, body, origin);
    if (body.action === "sort") return json({ sorted: await sortSome() }, 200, origin);
    if (body.action === "ping") return json({ ready: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN", "DRIVE_FOLDER_ID"].every((k) => env(k)) }, 200, origin);
    return json({ error: "unknown_action" }, 400, origin);
  } catch (e) {
    console.error(e);
    return json({ error: "server", detail: String((e as Error)?.message || e).slice(0, 200) }, 500, origin);
  }
});
