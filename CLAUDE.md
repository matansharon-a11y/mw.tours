# MW Photo Tours · tours.mw.photography

Live site for MW Photo Tours expeditions. GitHub Pages serves the `main` branch of this repo at
https://tours.mw.photography (see `CNAME`). **Every push to `main` goes live within 1–2 minutes**, so
commit finished work straight to `main`; there is no build step.

## Layout
- `index.html`: landing page ("Which expedition are you joining?"), lists the tours from `tours.json`.
- `tours.json`: one entry per expedition: `path` (folder), `slug` (the id inside that page's
  `<script id="vault">`), `title`/`place` in `en` and `he`, `start`/`end` (YYYY-MM-DD), `cover`.
- `<tour>/index.html` (`manas-kaziranga/`, `iberian-lynx/`, `pyrenees/`, `iceland/`): one expedition each, with its
  own `img/`, `map/`, `photos/`. The trip content is encrypted in `<script id="vault">` with the
  expedition code (PBKDF2 + AES-GCM); never try to read or guess codes, and never write a code into a file.
- `assets/members.js`: loaded by every tour. Traveler name on the code screen, Supabase sync of lists and
  progress, group photo uploads on the Field cards. When you change it, bump `?v=` in every tour page.
- `admin/`: Matan's admin (Supabase login): connect an expedition once with its code, see the code,
  add the traveler list (only a name on it can join: first, middle or last name, then the code; an empty
  list means no one can join; the first sign-in needs a connection, there is no code-only way in),
  shared photos. Tapping a traveler's name opens `<tour>/?as=<member or list id>` (also before they joined): that traveler's view,
  read only (`assets/viewas.js` keeps their lists in that tab so the admin's own are untouched).
- `assets/`: favicon set (same as the MWP site), logo, contour image, `fonts.css` + `fonts/` (Heebo for Hebrew).
- Type, on every page: English in Google Sans, Hebrew in Heebo, both kept in `assets/fonts/` (no Google Fonts).
  Font stacks start "MW Hebrew" (Heebo, Hebrew letters only), "MW Sans" (Google Sans). No other fonts.
- Supabase project `uiydebfzuxnxjqcnrylv`. Setup and updates are plain `.txt` files (not `.sql`).

## Every expedition gets the same features (fill them in the vault when making a new one)
- Map: each day its own frame; park days a `spot` (gold ring + label) where the day happens.
- Per-traveler flights: `personal` entries matched by name (Manas & Kaziranga is the example).
- Header photos (`heroes.<room>`): HD (about 2560 px wide), `focus`, optional `tall` (people photos),
  optional `phone` image + `phoneFocus` when the subject would sit under the title on a phone.
- Leader: optional `leader.story` {he, en: {kicker, by, text[]}}, shown in the text column beside the photo.
- No photo beside the Flights block.
- Story kinds: wildlife, conservation, legend, culture, history, food, landscape, sky (the last two came with Iceland).
- A tour without photos yet works: no `heroes` = plain room headers, stories/field cards show the contour placeholder,
  `tours.json` `cover: ""` shows an icon. Iceland (`iceland-2026`) is like that until Matan sends photos.
- Map layers (`map/*.webp` + the `geo` block): Iceland's are drawn, not satellite (Natural Earth land/glaciers, geoBoundaries
  coast, shaded relief), detail layers fade at their edges; `geo.credits` replaces the default credit line.
- Flight tickets: "Add your flight ticket" beside "Add to calendar" (`assets/tickets.js`, read in the browser: pdf.js for
  PDFs, Tesseract OCR for JPG/PNG; nothing is uploaded). The traveler checks the rows, they are kept in
  `mw-tour-<slug>-flights` (synced like the lists, so the admin's view-as shows them). The Flights block is empty until
  then for everyone (also travelers with a `personal` entry; that only shapes their map days now).
  Each added flight has a small pencil that opens the sheet on that row to edit it.
  Saved flights carry `by` (the member id) and `v: 2` (all earlier saves were cleared on 11.10.2026); only that traveler sees them. `members.js` keeps one owner per browser
  (`mw-tour-<slug>-owner`): when a different traveler signs in there, the lists/field/flights on it are cleared first.
  A ticket with several travelers (a couple on one booking): the signed-in name is matched to a name on it (Mr/Ms …,
  SURNAME/GIVEN MR; Sara/Sarah, Haim/Chaim count); when each traveler's part holds different flights, only theirs are
  taken, otherwise the shared ones; the sheet says whose flights these are, or warns when the name is not on the ticket.

## Rules
- Every expedition, now and future, has the same interface as Manas & Kaziranga (the reference): a UI change to
  one tour goes into all the others too (only the vault, the map data and the photos differ between them).
- Per-traveler trip: the vault may hold `personal: [{names, patch}]`. The page applies the first entry whose
  name's words all appear in the signed-in traveler's name (from `mw-tour-<slug>-member`): the patch merges into
  the trip (objects merge, arrays/values replace, null removes, `days` keyed by day number). Manas & Kaziranga
  uses it for each traveler's return flight from Guwahati; everyone flies Tel Aviv → Abu Dhabi → Delhi together.
- Map days: each day has its own frame (`steps[].bbox`); days in a row with the same frame are spread automatically
  (`spreadDays`). A park day can carry `spot: {lonlat, he, en}`: a marked, labelled place shown on that day only.
- The Flights block never shows a photo beside it (even if the vault has one); keep it that way in new tours.
- A new expedition: copy an existing tour folder as the template, give it its own vault/maps/photos,
  add it to `tours.json` with its `slug`, then Matan connects it once in `/admin`.
- Pages are Hebrew-first with English; check both and phone width before pushing.
