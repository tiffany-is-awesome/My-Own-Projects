# Wearwise (formerly Unique Ava): change log (written for AI reviewers)

> **If you are an AI reading this:** Wearwise (called Unique Ava before 2026-11-20; older entries use that name) is a personal-styling and digital-wardrobe web app.
> The newest change is at the top. Each entry says what changed, why, which files, how to check it,
> and what is still open. The owner may ask you to review, critique or extend it.

**Repo:** https://github.com/tiffany-is-awesome/My-Own-Projects (public) · app source in `wearwise/`
**Live site:** https://tiffany-is-awesome.github.io/My-Own-Projects/wearwise.html (the old `unique-ava.html` forwards here)
**Design & architecture:** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · [`docs/UX-AND-ROADMAP.md`](docs/UX-AND-ROADMAP.md) · setup: [`SETUP.md`](SETUP.md)

## The app in 30 seconds
- **Stack:** React 18 + Vite, built into ONE self-contained file (`/wearwise.html` at the repo root, served by GitHub Pages).
  Build: `cd wearwise && npm install && npm run build`. Tests: `npm test` (Vitest, rules engine).
- **Look:** minimalist "boutique" style (white / `#F4F4F4`, crisp grids, product cards, spec sheets).
- **Screens (since Phase 1):** Home · My Closet · **Create an Outfit** (primary) · Builder (4:5 stage) · Saved Outfits ·
  Family · Settings. Also: Style Me With This (`#/style/<id>`), History (`#/history`), Closet insights (`#/insights`), Lookbooks & trips, Inspiration.
- **Accounts:** Supabase Auth + table `public.unique_ava_data` (one JSON row per user, Row Level Security).
  Same Supabase project as the owner's other apps (Tiffo, Pantry to Plate).
- **AI stylist:** Google Gemini through **Puter.js** (no API key; each user signs in to Puter). Used for photo tagging,
  four-pillar critique, Mix & Match picks and reading inspiration photos. A deterministic **rules engine**
  (`src/ai/critic.js`, `generator.js`, `context.js`) is the always-available fallback and grounds the AI's critique.
- **Visuals:** garments are SVG renders (`src/components/GarmentArt.jsx` flat-lay, `Worn.jsx` on the mannequin).
  Real photos (e.g. generated with Gemini) can replace them via `wearwise-photos/manifest.json`.

## Key files
| File | What it does |
|---|---|
| `src/ai/claude.js` | AI connection layer: Gemini via Puter (main), Claude in the claude.ai preview, optional Supabase proxy |
| `src/ai/stylist.js` | The four AI features: prompts + validation of the JSON the AI returns |
| `src/ai/critic.js` | Rules engine: 5 pillars (proportions; weather & comfort; color & pattern; occasion & formality; style, shoes & accessories) |
| `src/ai/generator.js` | 3 distinct outfits, Style Me directions, alternatives, family coordination (owned + available items only) |
| `src/ai/insights.js` | Phase 2: versatility, Rediscover My Closet, wear stats, learned preferences from ratings |
| `src/ai/quality.fixture.js` | Test-only closets (bold/patterned, tiny) used by the outfit-quality tests |
| `src/ai/planner.js` | Trip planner: one strong, different outfit per day, re-using pieces; packing list |
| `src/views/Calendar.jsx` | Outfit calendar, day planning, trips |
| `src/components/Choose.jsx` | Context picker chips, outfit card, side-by-side comparison |
| `src/components/Worn.jsx` | Outfit drawn fitted on a front-facing mannequin |
| `src/components/GarmentArt.jsx` | Realistic flat-lay product renders |
| `src/auth.jsx`, `src/components/Account.jsx` | Sign-in and cloud sync |
| `supabase/wearwise.sql` | Table + Row Level Security |

---

## 2026-11-22 · Final refinement & functional quality pass
Owner's brief: *"The goal is not to make Wearwise bigger. The goal is to make it better."* Inspected first, nothing rebuilt.

**Rename finished.** Code folder `unique-ava/` → `wearwise/` (links: `wearwise/ALL-CODE.txt`, `wearwise/CHANGELOG.md`); browser storage `unique-ava.v1` → `wearwise.v1` and sign-in `unique-ava.auth` → `wearwise.auth`, each copied over once so nobody loses a closet or gets signed out; `#/dressing` links → `#/builder`; last "dressing room" wording gone. `unique-ava.html` still forwards to `wearwise.html`. Database table: see *Not yet done* below.

**Found and kept unfinished work** (uncommitted, 2026-11-20): improved background removal (edge-connected flood fill with colour tolerance, gradient backgrounds), "not checked yet" flags, privacy text, consent before sending a whole photo, shared lookbooks that carry the pieces, rewritten Inspiration matcher. Reviewed and covered by tests before building on it.

**1 · Privacy & image processing**
- Upload: what's sent depends on what happened. A clean cut-out is sent to Gemini; if the cut-out failed, *nothing* is sent unless she taps "Ask Gemini using the whole photo" (the button says so). Settings has a plain "What stays on your device / what is sent to Gemini" section.
- Inspiration: typed looks are matched on the device by keywords ("no AI"); a photo is sent to Gemini only after she taps "Identify the pieces with Gemini", with a note that nothing has been sent yet.
- Photos whose background couldn't be removed are kept exactly as taken and shown as a neat photo card (never stretched or recoloured).

**2 · Honest identification**
- The on-device fallback measures colour only. Type is a guess (file name or outline); fabric is left blank; fit, warmth, formality and rain-readiness are neutral placeholders. All of these are flagged "Not checked yet" on the item and on its card ("Check details"), with one-tap "Everything looks right". Editing any field clears its flag. Gemini results are also flagged unless Gemini is confident (≥ 0.75), and fabric is always flagged.
- Outfit cards say when they use pieces with unchecked details ("this verdict is less certain"). Guessed fabrics are never used to judge an outfit.

**3 · Outfit intelligence**
- **Quality bar:** only outfits scoring ≥ 76 with no deal-breaker are shown. A small closet gets one or two good outfits with an honest note ("Only 2 good outfits can be made from this closet for sports, so that's all you're shown"); if none reach the bar, the single closest option is shown, labelled. Gemini picks are held to the same bar.
- **New taste rules:** fabrics from different worlds (silk/satin with fleece/sweats) flagged; smooth-against-textured praised; same-wash double denim flagged, different washes praised; two different colours at the same depth meeting at the waist flagged ("they compete").
- Variety: the three outfits share at most one core piece.
- Transparency: the outfit page says Gemini picks "from the details of your clothes (type, colours, fabric, warmth…), not by looking at your photos".

**4 · Visuals**
- Cut-outs keep only the garment, cropped tight; failed cut-outs become photo cards.
- Mannequin captioned "a styling guide, not a virtual try-on"; the old "On you" mode renamed "With your photo" and captioned "Not a try-on: the pieces are shown beside the photo".
- Swapping a piece re-animates only that piece into place.

**5 · Reliability, sync & security**
- **Cloud sync rewritten (same table, same architecture):**
  - Saves are *conditional*: a save only goes through if the account copy is still the version this device last saw. If another device saved in between, nothing is overwritten and she chooses "Use the other device's version" or "Keep this device's version".
  - Returning to the tab loads newer changes from another device automatically (if this device has nothing unsaved).
  - No connection → "Offline · your changes are kept on this device", saved automatically when the connection returns; closing the page with unsaved changes warns.
  - "Delete all my data" now pauses sync, deletes the account copy, signs out, then clears the device, so nothing can be re-uploaded. If the cloud delete fails it says so.
  - Works with either table name (`wearwise_data`, or the older `unique_ava_data`).
- **Security review (live database):** RLS is on; read/insert/update/delete are each limited to `auth.uid() = user_id` for signed-in users; anonymous users can't read anything. Found: the table also granted TRUNCATE/REFERENCES/TRIGGER to `anon` and `authenticated` (TRUNCATE ignores RLS; not reachable through the website's API, but unnecessary). Fix prepared in `supabase/wearwise.sql` (see *Not yet done*). Supabase advisor also recommends turning on *leaked password protection* (Auth settings, one switch).
- **Large wardrobes:** 336 pieces → 3 outfits in ~0.1 s. Wardrobe versatility for 120 pieces takes ~5 s of work, so it now runs in small batches with a progress line and never freezes the page. Settings shows how much data the account holds (photos are stored inside it); above 12 MB it explains the 30 MB limit and slower syncing. *Recommendation for later:* move photos to Supabase Storage so each save only sends text.

**6 · Inspiration**: wider vocabulary (≈100 garment words, ≈50 colour words: "oatmeal", "sage", "cognac"…), matching by type, colour family and shape; each match labelled **Exact / Close / Approximate** with the reason, missing pieces named with the closest thing she owns; "Recreate with my clothes" opens the builder with her matches (missing slots left empty). "Pieces read from the text by keyword matching (no AI)" vs "Pieces identified by Gemini from the photo" is shown on every look.

**7 · Tests (actual results, 2026-11-22)**
- `npm test`: **58/58** (incl. 5 new fabric/contrast tests, quality-bar test, inspiration matcher tests).
- Browser tests now live in the repo: `wearwise/tests/e2e/` (`bash wearwise/tests/e2e/run_all.sh`). All pass: cut-outs 6/6 (incl. a white-on-white photo correctly kept as taken), uploads 7/7 (one photo, a broken file, retry, a mixed batch, edit, delete, reload), core flow 25/25, Phase 2 12/12, polish 21/21, calendar/wardrobes 23/23, shared lookbook on a second browser 3/3, old-address forwarding 4/4, storage-name migration 3/3, inspiration 5/5, tip jar hidden 1/1.
- **Simulated** cloud sync 10/10 (twice: new and old table name). A fake Supabase runs inside the test: two devices, a conflicting edit (nothing overwritten, choice works), going offline and back, picking up another device's change, delete-all (row gone, stays gone, signed out). *This checks Wearwise's logic, not the real Supabase service.*

**Not yet done / still unverified**
- **Database change awaiting the owner's approval** (twice timed out): rename `unique_ava_data` → `wearwise_data` (0 rows, nobody affected), remove the unneeded TRUNCATE/REFERENCES/TRIGGER grants, add a 30 MB per-account cap and a server-side save timestamp. Until then the site uses the old table name automatically.
- Real Supabase sign-up, email confirmation, sign-in/out and password recovery; real two-device sync; real Gemini answers; real phone photos. None of these could be run without the owner's sign-ins.
- Email links still return through `unique-ava.html` (the address approved in Supabase), which forwards to `wearwise.html`.

---

## 2026-11-20 · Donut chart removed
- The closet donut chart (a misreading of the owner's "donut", which meant a tip jar) is **removed completely**: `components/ClosetDonut.jsx`, its place in Closet insights and its styles are gone. The 🍩 tip jar stays.
- Tests: `npm test` 49/49; headless Chrome: calendar/wardrobes flow 23/23 (incl. no chart on Home or Insights), 21/21, 25/25, 12/12, 4/4; tip jar still hidden while unconfigured 1/1.

---

## 2026-11-20 · 🍩 "Treat the developer to a donut" (tip jar, like Tiffo)
- The owner's "give me a donut" meant a **donation** to the developer, as in Tiffo, not a donut chart. Added `components/TipJar.jsx`: a discreet card *"Saved you time? Treat the developer to a donut"* with a **GCash / QR Ph** button (opens the QR in a pop-up, with the name under it) and a **💳 Card / PayPal** link. It sits at the bottom of Home for returning users, in Settings, and as a footer link. Its "time saved" line only counts real activity (outfits saved, planned or worn).
- **Off until configured** (same rule as Tiffo): fill `GCASH_QR` (an image next to `wearwise.html`, e.g. `gcash-qr.png`, or an image URL), optionally `GCASH_NAME`, and/or `TIP_URL` in `src/config.js`, then build. With nothing filled in, visitors see no card and no broken button. *Currently nothing is filled in, so it is not visible on the live site.*
- The closet donut **chart** was moved off Home (it stays in Closet insights, opened from My Closet → Insights).
- Tests: tip jar off → no card/link (1/1); with temporary test values → card, PayPal link, GCash QR pop-up with name, footer link (4/4), test values removed before publishing; all other suites still pass (49/49 unit, 29/29, 21/21, 25/25, 12/12, 4/4).

---

## 2026-11-20 · Honest verdicts, closet donut, wardrobes, outfit calendar & trips
Owner's requests: *"be honest on the looks"*, *"a 'give me a donut' thing like in Tiffo"*, *"a clothes calendar so the user can plan outfits for trips"*, *"different 'wardrobes' in one person's wardrobe… 'work', 'home'"*, *"don't make the website too complicated"*.

**Honest verdicts** (`verdictOf` in `critic.js`, `<Verdict>` in `common.jsx`)
- Every outfit now carries a plain verdict next to its score, written like a frank friend: **Great look** (≥ 88, with any small note), **Good outfit** (78–87, its main weakness), **Okay, not exciting** (68–77, "wearable, but…"), **Not recommended**, and **Doesn't work** whenever a deal-breaker applies (stating it, e.g. athletic shoes with a cocktail dress). Shown on outfit cards, comparison, Today's outfit, family looks, the calendar and, most prominently, in the builder for outfits you put together yourself.
- Previews say what they are: flat-lays drawn from item details are labelled "Illustrations… not photos" (or "some pieces are illustrations") in the builder.

**Closet donut** (`ClosetDonut.jsx`; a misunderstanding of the owner's "donut", see the tip-jar entry above)
- In Closet insights (was also on Home until the next change). Three views: *What's in it* (by category), *Colors* (slices wear the garments' own colors, top 7 + "Other"), *What you wear* (wears per category from Outfit History, with **This month · 90 days · All** like Tiffo, plus how many pieces weren't worn in the period). Hover a slice to see its count and % in the centre; the list beside it names every slice with count and %. Tapping a slice opens My Closet filtered to it (`#/closet/category:shoes`, `#/closet/color:black`).
- Category colors were checked with the dataviz palette validator (6 slots pass colour-blind and normal-vision separation; the light slots carry text labels as required). Slices animate in; off with reduced motion.

**Wardrobes** (groups inside each person's saved outfits)
- Saved Outfits has tabs: All · ♥ Favorites · each wardrobe. After saving any outfit, chips let you drop it into a wardrobe or start one ("+ Work", "+ Home", "+ Going out", "+ New"). Rename or delete a wardrobe from its tab (outfits stay saved). Per person, removed with the person.

**Outfit calendar & trips** (`Calendar.jsx`, `planner.js`; desktop nav *Calendar*, phone *More → Outfit calendar*)
- Month view (Monday first). Tap a day: plan it from saved outfits (filter by wardrobe/favorites) or *Suggest one* (occasion/weather/style chips → 3 options). Planned days show the outfit; *I wore it* marks the day as worn (it also goes to Outfit History, so the donut and Rediscover learn from it). *Coming up* lists the next plans.
- **Plan a trip:** name, dates (up to 31 days), occasion, weather → one strong outfit per day (no deal-breakers, score ≥ 72), never the same outfit twice and never the same top two days running, deliberately re-using bottoms, shoes and layers so the bag stays small. Shows every day plus a **packing list** with tick-boxes and how many days each piece is worn; *Try other outfits* re-plans. Saving puts the trip on the calendar (blue band) with its packing list under *Trips*. Honest when the closet is too small ("some days repeat").
- Store: new `wardrobes`, `plans`, `trips` arrays in the same saved data (older data gets empty defaults); removed with a person or with demo data.

**Fix found while testing:** pop-ups on phones could sit underneath the bottom tab bar (the page-transition animation trapped them). Fixed.

**Tests (actual results)**
- `npm test`: **49/49** (+4 trip-planner tests, +1 honest-verdict test).
- Headless Chrome, desktop + 390px phone, new flow **27/27**: verdicts on Today/cards/builder, donut (6 slices, colors view, honest empty "what you wear", slice → filtered closet), save → Work wardrobe → Work tab, plan today from saved, *I wore it* tick, plan a 4-day trip (4 different outfits, 7 pieces to pack), trip on calendar, plans persist after reload, no page errors. Existing flows still pass: 25/25, 12/12, 21/21, address-forwarding 4/4.

**Still unverified:** real Gemini answers, real Supabase sign-up/login/sync across devices, real phone photos; calendar and donut checked in headless Chrome only.

---

## 2026-11-20 · New address: wearwise.html
- The app is now built to **`/wearwise.html`** (https://tiffany-is-awesome.github.io/My-Own-Projects/wearwise.html). `scripts/publish-single-file.js` writes there.
- **`/unique-ava.html` is now a tiny forwarder**: it sends visitors to `wearwise.html`, keeping the page they asked for (`#/closet`…) and any sign-in token from an email link. Old shared links keep working. Saved closets carry over (same site, same browser storage key `unique-ava.v1`).
- Sign-up and password-reset emails still return to `unique-ava.html` (the address already approved in Supabase), which forwards to Wearwise with the token intact, so no Supabase setting had to change. *Not yet tested with a real confirmation email.*
- Docs and the repo README point to the new address.
- Tests: `npm test` 44/44 · headless Chrome: forwarding 4/4 (page kept, saved closet kept, token kept, title), flows 25/25, 12/12, 21/21 on the new address.

---

## 2026-11-20 · Renamed to Wearwise
- Every name people see is now **Wearwise**: browser tab title, logo (mark "W"), Home copy, Settings, History, footer, shared lookbooks, docs and the repo README.
- **Deliberately unchanged** so nothing breaks: the address `unique-ava.html`, the source folder `wearwise/`, the browser storage key `unique-ava.v1` (saved closets keep loading), the Supabase table `unique_ava_data` (accounts keep their data) and the `unique-ava-ai` function. Older changelog entries keep the old name as history.
- Tests: `npm test` 44/44 · headless Chrome flows 25/25, 12/12, 21/21 after the rename.

---

## 2026-11-20 · Polish & everyday usefulness (product polish brief)
Audit first (screenshots of every main screen on desktop 1360px and phone 390px), then fixes in order of impact. No rebuild; same architecture, no new dependencies.

**Problems found → fixed**
1. **Phones had no navigation at all** and the header ran off-screen (Sign in cut off). → Bottom tab bar on phones (Home · Closet · Create · Saved · More) with a raised Create button; a **More** page for History, Insights, Builder, Family, Lookbooks, Inspiration, Settings; compact header. Desktop nav trimmed from 8 links to 6 (Home, My Closet, Create an Outfit, Saved, History, Family); Settings is a gear icon; the Builder opens from outfits ("Open in builder").
2. **Explanations read like a machine** ("Consistent feel: the pieces share a minimalist / casual mood… Textbook."). → Stylist voice in the order a stylist thinks: color story → shape → why it suits the day and weather → finishing touch → one thing to watch. E.g. *"The olive trousers are the one pop of color against calm neutrals. Their relaxed cut is balanced by the neater white tee. Right for work at 17°C, and the black boots will shrug off puddles."* No piece is mentioned twice.
3. **Outfit names were generic and repeated** ("Relaxed · Easy" ×2). → Named by the pieces that define the look ("Off-White Shirt & Black Trousers"); the mood ("Smart · Minimalist") moves to a small line above.
4. **Home didn't use the closet.** → Returning users get **Today's outfit** from their own available clothes (weather chips, *Another idea*, ♡ Save, *I'll wear this*), **one-tap quick outfits** (Work, Date night, Church, Party, Vacation, or *Something else…*) that open Create an Outfit with results already made, shortcut tiles (Add clothes, Rediscover, Family look, History) and recently saved looks. First-time visitors get the brand promise as the headline.
5. **Results were buried under the form on phones.** → After generating, the form collapses to a sticky one-line summary (*Change* / *New ideas*) and the page scrolls to the outfits.
6. **No way to search the closet.** → Search box (matches name, color, material, type, style, pattern and storage place, all words must match) and sorting (newest, A–Z, most worn, least worn). An empty result offers *Show everything*.
7. **Improve This Outfit** was a plain list. → The builder now has a highlighted **✦ Improve this outfit** button that applies the single best owned-only change (+points shown), or says when the outfit is already the strongest version; other ideas stay listed. Outfit cards say *Improve or change*.
8. Canvas bags in the rain are now flagged (found during Today's outfit testing).

**Animations & graphics (owner's request)**: garments land on the flat-lay one by one; the mannequin fades in; scores count up inside a colored ring (green ≥ 85, amber < 72); a heart burst on save; a "stylist at work" animation with real step text while outfits are made; Home hero cycles three example looks (labelled *illustration*) between flat-lay and mannequin over soft floating color fields; staggered card entrances; page transitions; a gentle sheen on *Improve this outfit*. All of it is switched off for people with *reduce motion* turned on.

**Tests (actual results)**
- `npm test`: 44/44.
- Headless Chrome, local build: Phase 1 flow 25/25, Phase 2 flow 12/12, new polish flow **21/21** on desktop and a 390px phone (landing hero, Today's outfit, Another idea, rainy Today avoids suede/sandals, quick occasion → results, Improve this outfit, closet search, tab bar visible on phone / hidden on desktop, More → History, no horizontal overflow, Sign in fully visible, no page errors).

**Still unverified**: unchanged from the 2026-11-20 live-test entry (real Gemini answers, Supabase sign-up/login/sync, real phone photos). Animations were checked in headless Chrome screenshots, not yet on a real phone's frame rate.
## 2026-11-20 · First live test on the real site + fix
**PRs:** #18 (quality, photos, locations, Phase 2 merged to main) · #19 (fix below)

**Tested live** (https://tiffany-is-awesome.github.io/My-Own-Projects/unique-ava.html, desktop browser):
- The new version is served: navigation shows Home, My Closet, Create an Outfit, Builder, Saved Outfits, History, Family, Settings. Puter.js loads.
- **Signed out of Puter → "Get 3 outfits": BUG FOUND.** Puter's own consent/sign-in dialog popped up uninvited and the page stalled on "Looking through 23 pieces…" until it was answered. Pressing *Cancel* did fall back correctly to the rules engine with an honest message.
- **Fixed (#19):** the AI is only called when Puter reports the user is signed in; otherwise the rules engine answers immediately (no pop-up), the header shows the signed-out state, and an inline "Sign in for Gemini" button starts sign-in from the user's own click. Photo tagging follows the same rule (falls back to the on-device guess with a note). Re-tested locally: `npm test` 44/44, headless Chrome 25/25 + 12/12.

**Still NOT verified live (owner had no time for the sign-in session; nothing here should be read as working until tested):**
- A real Gemini answer via Puter: photo tagging accuracy on real clothes, AI outfit picks, AI critique, and the post-fix signed-out behaviour on the live site.
- Supabase: sign-up → email confirmation → logout → login → wardrobe restored; same account on a second device.
- Real phone photos (camera, lighting, busy backgrounds, several items in one shot) and how they look in flat-lay and on the mannequin.
- Real users' judgment of outfit attractiveness over time (needs History ratings).

**How to run these later (≈10 min):** sign in with "Gemini · Sign in" (Puter, free), create a Unique Ava account with "Sign in", then upload 4–6 real photos from a phone on the live site and run Create an Outfit, Style Me With This and a Family look.

---

## 2026-11-19 (evening) · Quality pass, photo accuracy, storage locations, Phase 2
**Branch / PR:** `unique-ava-phase1` (PR #15, same branch) · nothing rebuilt; all Phase 1 tests still pass.

**1. Outfit quality (tested against a deliberately hard closet)**
A new test closet (`quality.fixture.js`: florals, checks, stripes, red/pink/mustard, platform sneakers, running shoes, heels, cocktail dress, joggers, straw tote…) was run through 11 occasion/weather cases and judged by eye. Problems found and fixed in `critic.js` / `generator.js`:
- *Serious flaws were averaged away* (cocktail dress + running shoes scored 84). New **deal-breakers** cap the score at 68 (60 for two) and are listed first in "Watch": athletic shoes with dressy pieces, sandals/heels/suede in rain, open shoes below 18°C, far too warm/cold, a very casual piece at a dressy occasion (graphic tee under a coat at work), a black-tie piece at an everyday occasion, sporty/street pieces with polished ones at work or church, clothes you can't move in for sports.
- *Padding to three:* bad outfits are no longer shown just to fill three slots. With a small closet you get fewer, with an honest note ("Only 1 strong outfit can be made from this closet for a wedding…"). Results are sorted best first.
- Smaller fixes: casual canvas/straw bags at occasions of formality 3+, straw bags in rain or cold, boots and warm tops at 27°C+, chunky/street sneakers no longer count as a "modern high-low" touch, style clashes weigh more, casual shoes at dressy occasions, a crash on items without a material.
- The AI is held to the same bar: Gemini picks with any deal-breaker or a score under 70 are replaced by the rules engine. A "Weak option" tag shows if one ever has to be shown.

**2. Photo accuracy (uploads)**
- Cut-outs now keep only the largest connected piece (crumbs, lint and background bits removed) and are **cropped to the garment**, so it fills its place in the flat-lay and on the mannequin. Garment pixels are never recolored or reshaped.
- If the cut-out fails (garment the same color as the background), **the original photo is kept as taken**, with a message asking her to check the color.
- Without AI, the category guess now reads the silhouette (two legs → trousers, sleeves → top) instead of only the width-to-height ratio.
- On the mannequin, photo pieces are anchored (tops at the shoulders, bottoms at the waist, shoes at the feet) and labelled "placed as taken, not reshaped to the body".

**3. Storage locations (owner's request)**
Household-wide places ("Bedroom closet", "Under-bed box", "Lola's house"…), managed in Settings or added on the spot from any item ("+ Add a place…"). Each item shows where it's kept; My Closet filters by place (and "No place set").

**4. Phase 2**
- **Outfit History:** "I wore this" on outfit cards, Style Me, Saved Outfits and the builder. History page per person: date (editable), 1–5 stars, quick feedback (Loved it, Got compliments, Comfortable, Uncomfortable, Too warm/cold, Too formal/casual, Didn't feel like me), delete.
- **Personalized recommendations:** ratings and feedback become small nudges per item, color and style (`preferenceProfile`), applied within ±8 points so taste only chooses *between* outfits that already pass every check. Pieces worn in the last 3 days are nudged down for variety. Gemini is told which pieces she rated highly/poorly. The History page says in plain words what has been learned; Create an Outfit says when results are personalized.
- **Rediscover My Closet** (`#/insights`): pieces not worn for 30+ days (or never; skips items added in the last 14 days), each in a strong outfit, varied so suggestions don't repeat the same partners; "I'll wear this" logs it.
- **Wardrobe versatility** (`#/insights`): for each available piece, how many other pieces it makes strong outfits with and in which of six everyday situations; pieces that work nowhere are highlighted with the reason (e.g. nothing at its level of dressiness). Score = share of pieces that pair with ≥3 others in ≥2 situations.

**Database:** no schema change; `locations`, `history` and `addedAt` live in the same JSON row. Older data gets empty defaults.

**Tests (actual results, 2026-11-19 evening)**
- `npm test`: **44/44 pass** (+9 outfit-quality tests, +8 Phase 2 tests).
- Headless Chrome, local build: Phase 1 flow **25/25**, Phase 2 + locations flow **12/12** (places, filter, add place from item form, I wore this, ratings + feedback, learned summary, persistence after reload, personalized results, versatility table, rediscover, per-person history, no page errors).
- Synthetic messy photos (textured sheet, crumbs, small/off-centre garment, garment cut off at the edge, white-on-white): 4 clean cut-outs cropped to the garment, white-on-white correctly kept as the original photo.

**Still NOT verified (needs the owner, the live site and real devices):**
- A real Gemini request via Puter (tagging accuracy on real photos, AI outfit picks, AI critique), and the not-signed-in / Puter-down paths on the live site.
- Real Supabase sign-up → logout → login → wardrobe restored, on two devices.
- Real phone photos (lighting, busy backgrounds, multiple items in one shot). The synthetic tests can't stand in for these.
- Whether the recommendations *look* attractive to real users over weeks of use (needs real feedback data).

---

## 2026-11-19 · Phase 1: real wardrobe, Create an Outfit, compare, Style Me, family looks
**Branch / PR:** `unique-ava-phase1` · plan: [`docs/DEVELOPMENT-PLAN.md`](docs/DEVELOPMENT-PLAN.md)

**What changed (and why)**
- **Empty start, no fake data.** New users start with an empty closet. The old built-in "basics" (items she didn't own) are gone; suggestions only use her own *available* items. A clearly labelled **demo closet** (incl. sample Dad + Mia) can be added and removed in one click. Old saved data is migrated (`store.jsx → migrate`, data v2).
- **Closet:** batch upload (up to 12 photos) with a review list, camera capture, **add without a photo**, edit any item (shared `ItemForm`), status (available / laundry / repair / stored), filters by category, color, style, occasion, season, status. New categories: dresses; hats, necklaces, belts; bags get their own slot.
- **Create an Outfit:** chips for occasion, weather, style, preferences + optional note and "wear this piece". Gemini picks 3 outfits; the **rules engine validates every pick** (owned, complete, weather-safe, score ≥ 62) and tops up from its own picks. Each card: preview (flat-lay / mannequin), explanation, "watch" note, items, **Change items** (owned-only alternatives with score delta), ♡ Save, Open in builder.
- **Compare side by side:** previews, pieces, why, strengths, weaknesses, occasion + weather suitability, pillar scores, "♥ This one" saves it as a favorite.
- **Style Me With This:** 4–5 directions (for the occasion, casual, elegant, minimalist, trendy), the chosen piece in every one.
- **Stronger scoring:** new 5th pillar (style consistency, shoe fit, accessory clutter, visual balance), pattern compatibility, comfort, deal-breakers (suede/canvas/sandals in rain, sandals in cold, heavy pieces in heat, sneakers/canvas tote with elegant looks).
- **Family:** profiles (adult/child), profile switcher in the header, strictly separate closets and saved outfits, **Family Look** (coordinated color + formality, not identical), saved family looks, child-sized mannequin.
- **Builder:** 6 slots, dress replaces the bottom, alternatives list replaces the single swap tip, fake "Generate scene" removed (scenes are labelled "illustrated backdrop · not a photo").
- **Saved Outfits** (favorites, delete) and **Settings** (account, Puter sign-in, family members, demo on/off, **delete all my data** = local + Supabase row).

**Database:** no schema change. Data model v2 is migrated client-side inside the existing `unique_ava_data.data` JSON. RLS delete policy already existed (used by "delete all my data").

**Tests (actual results, 2026-11-19)**
- `npm test`: **27/27 pass** (context, critic, generator, Style Me, alternatives, family, migration, AI validation with a stand-in AI).
- Headless Chrome end-to-end (`/tmp/e2e/flow.py`, local build, no network): **25/25 pass** — empty start, honest "missing items" message, manual add, demo load + banner, filters, 3 outfits for rainy work (no suede), alternatives, compare, save + favorite, persistence after reload, Style Me (4 directions), builder dress, family look (3 members, kid only in kid clothes), profile separation, remove demo, delete all.
- **Not yet tested live:** a real Gemini request (needs a Puter sign-in), real sign-up → logout → login persistence on Supabase, real photo uploads on a phone. In the sandbox the AI call failed (no network) and the app correctly fell back to the rules engine with a visible message.

**Still open:** wardrobe versatility, Rediscover My Closet, outfit history & feedback (Phase 2); calendar, packing, assistant (later).

---

## 2026-11-19 · Gemini with no API key (Puter) + fitted mannequin
**PR:** https://github.com/tiffany-is-awesome/My-Own-Projects/pull/11

**What changed**
1. **AI stylist now runs on Google Gemini through Puter.js.** There's no API key on the site or the server.
   The first time a user uses AI (or clicks **Gemini · Sign in** in the header), Puter shows a sign-in pop-up
   (free account). Her usage runs on her own Puter allowance; the owner pays nothing.
   - Models: `google/gemini-3.5-flash` (fallback `google/gemini-2.5-flash`); quick tasks try `google/gemini-3.5-flash-lite` first.
   - Images: sent as a data URL; if Puter rejects that, the cut-out is written to the user's Puter storage and sent by path.
   - Until she signs in, the rules engine answers. Inside the claude.ai preview (which blocks outside scripts), Claude stands in.
   - The key-based Supabase function `unique-ava-ai` stays in the repo as an optional backup, switched off (`AI_PROXY_URL: ''`).
2. **Mannequin fixed.** Clothes were flat-lay drawings pasted on the figure (boxy tops, sideways shoes, floating bag).
   They're now drawn *as worn* in `src/components/Worn.jsx`: fitted torso, sleeves down the arms, trousers from the
   waist, front-view shoes on the feet, a tote held in the hand, a crossbody across the chest, a scarf around the neck.
   Pieces that only have a photo (user uploads, Gemini photos) are placed as cut-outs on top.
3. App wording is provider-neutral ("AI stylist"); the header badge names the provider.

**Files:** `src/ai/claude.js`, `src/App.jsx`, `src/components/Worn.jsx` (new), `src/components/Stage.jsx`,
`src/components/GarmentArt.jsx`, `src/views/*`, `src/config.js`, `SETUP.md`, `docs/ARCHITECTURE.md`.

**How it was checked:** build + 11 unit tests pass; browser tests with a stand-in for Puter covered sign-in, critique,
Mix & Match, photo tagging and the storage fallback; screenshots of the mannequin with several outfits.

**Open / not yet verified**
- No real Gemini call has been made yet: Puter's sign-in needs a person's own account. The first sign-in after merging is the first live test.
- Puter's exact response shape for every Gemini model is handled defensively (`textOf()` in `claude.js`); worth a check on first use.
- Garments are still illustrations. Real photos are planned (prompts in `GEMINI-PHOTO-PROMPTS.md`).

## 2026-11-13 · Accounts, rename, photo slots
- Renamed Atelier → Ava's Choices → **Unique Ava**.
- Supabase sign-in / sign-up / password reset; the whole wardrobe syncs to `unique_ava_data`. Table and login redirect are set up.
- Photo slots (`wearwise-photos/manifest.json`) so real photos replace renders without a rebuild.

## 2026-11-13 · First version
- Architecture + UX/roadmap docs; React prototype with closet, dressing room, rules-engine critic, mix & match, lookbooks, inspiration.
- Cartoon illustrations replaced with realistic renders at the owner's request.
