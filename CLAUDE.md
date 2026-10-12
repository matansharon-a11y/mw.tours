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
  It also puts a name badge (`#mw-who`, initials + first name) in the top bar: tap it for the full name and
  "Not you? Sign out" (back to the name + code screen; the next person starts clean).
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
- Leader role line: "Expedition leader, founder of MW Photo Tours" (`leader.role`), on every expedition.
- Leader: optional `leader.story` {he, en: {kicker, by, text[]}}, shown in the text column beside the photo.
- No photo beside the Flights block.
- Story kinds: wildlife, conservation, legend, culture, history, food, landscape, sky (the last two came with Iceland).
- A tour without photos yet works: no `heroes` = plain room headers, stories/field cards show the contour placeholder,
  `tours.json` `cover: ""` shows an icon. Iceland (`iceland-2026`) is like that until Matan sends photos.
- Map layers (`map/*.webp` + the `geo` block): Iceland's are drawn, not satellite (Natural Earth land/glaciers, geoBoundaries
  coast, shaded relief), detail layers fade at their edges; `geo.credits` replaces the default credit line.
- Flights, typed by each traveler: "Add your flights" beside "Add to calendar" (`assets/flights.js`: From/To picked from
  `assets/airports.js`, 3,244 airports with scheduled service from OurAirports, loaded when the sheet opens; date, times,
  flight no. optional). No file reading any more (ticket upload was removed 12.10.2026). Rows are kept in
  `mw-tour-<slug>-flights` with each airport's code, city and lonlat, synced to the traveler's own account; private: the
  admin's view-as does not show them. The Flights block is empty until the traveler adds flights.
  Each flight has a small pencil that opens the sheet on that row.
  Flights shape the map (`withTickets`, rebuilt from `RAW` + `buildMap()` on save): each flight becomes a flight line
  between its airports (new airport places `u-<code>`), and the group's own flight lines are dropped on the days of the
  traveler's way out (dates up to the first day) or back (from the last day). A flight on a trip day goes on that day
  (before the day's route on the way out, after it on the way back); flights before the first day go on day 0 (added
  as "Departure" when the trip has none); flights after the last day add a day each ("Flight" tag).
  Every tour map has `../assets/world-base.webp` (Blue Marble, whole world) as its first image, so far-away origins show land.
  Saved flights carry `by` (the member id) and `v: 3` (typed flights; earlier saves are ignored); only that traveler sees them. `members.js` keeps one owner per browser
  (`mw-tour-<slug>-owner`): when a different traveler signs in there, the lists/field/flights on it are cleared first.
  Server side one browser = one traveler per expedition (`supabase-update-one-traveler-per-browser.txt`: trigger on
  member_devices), so a browser used for two names never saves into the other person's account.

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
