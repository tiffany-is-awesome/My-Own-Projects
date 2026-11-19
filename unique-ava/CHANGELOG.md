# Unique Ava: change log (written for AI reviewers)

> **If you are an AI reading this:** Unique Ava is a personal-styling and digital-wardrobe web app.
> The newest change is at the top. Each entry says what changed, why, which files, how to check it,
> and what is still open. The owner may ask you to review, critique or extend it.

**Repo:** https://github.com/tiffany-is-awesome/My-Own-Projects (public) · app source in `unique-ava/`
**Live site:** https://tiffany-is-awesome.github.io/My-Own-Projects/unique-ava.html
**Design & architecture:** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · [`docs/UX-AND-ROADMAP.md`](docs/UX-AND-ROADMAP.md) · setup: [`SETUP.md`](SETUP.md)

## The app in 30 seconds
- **Stack:** React 18 + Vite, built into ONE self-contained file (`/unique-ava.html` at the repo root, served by GitHub Pages).
  Build: `cd unique-ava && npm install && npm run build`. Tests: `npm test` (Vitest, rules engine).
- **Look:** minimalist "boutique" style (white / `#F4F4F4`, crisp grids, product cards, spec sheets).
- **Screens:** Closet · Dressing Room (4:5 stage: flat-lay / mannequin / scene / "on you" + stylist spec sheet) ·
  Mix & Match (3 outfits for a situation) · Lookbooks & trips (versatility score, packing list, share links) · Inspiration.
- **Accounts:** Supabase Auth + table `public.unique_ava_data` (one JSON row per user, Row Level Security).
  Same Supabase project as the owner's other apps (Tiffo, Pantry to Plate).
- **AI stylist:** Google Gemini through **Puter.js** (no API key; each user signs in to Puter). Used for photo tagging,
  four-pillar critique, Mix & Match picks and reading inspiration photos. A deterministic **rules engine**
  (`src/ai/critic.js`, `generator.js`, `context.js`) is the always-available fallback and grounds the AI's critique.
- **Visuals:** garments are SVG renders (`src/components/GarmentArt.jsx` flat-lay, `Worn.jsx` on the mannequin).
  Real photos (e.g. generated with Gemini) can replace them via `unique-ava-photos/manifest.json`.

## Key files
| File | What it does |
|---|---|
| `src/ai/claude.js` | AI connection layer: Gemini via Puter (main), Claude in the claude.ai preview, optional Supabase proxy |
| `src/ai/stylist.js` | The four AI features: prompts + validation of the JSON the AI returns |
| `src/ai/critic.js` | Rules engine: proportions, fabric & weather, color harmony, occasion fit |
| `src/components/Worn.jsx` | Outfit drawn fitted on a front-facing mannequin |
| `src/components/GarmentArt.jsx` | Realistic flat-lay product renders |
| `src/auth.jsx`, `src/components/Account.jsx` | Sign-in and cloud sync |
| `supabase/unique-ava.sql` | Table + Row Level Security |

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
- Photo slots (`unique-ava-photos/manifest.json`) so real photos replace renders without a rebuild.

## 2026-11-13 · First version
- Architecture + UX/roadmap docs; React prototype with closet, dressing room, rules-engine critic, mix & match, lookbooks, inspiration.
- Cartoon illustrations replaced with realistic renders at the owner's request.
