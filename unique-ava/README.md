# Unique Ava: AI personal stylist & digital wardrobe

Your closet, run like a clean, minimalist boutique. Photograph your clothes (however messy),
mix outfits for real weather and places, get an honest four-pillar critique, and save looks
into shareable lookbooks.

**Live app:** `unique-ava.html` at the repo root (GitHub Pages:
https://tiffany-is-awesome.github.io/My-Own-Projects/unique-ava.html)

| Doc | What's in it |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System design, tech stack, AI pipeline, database schema, APIs, costs, privacy |
| [`docs/UX-AND-ROADMAP.md`](docs/UX-AND-ROADMAP.md) | Design tokens, screens & flows, phased roadmap, metrics |
| [`CHANGELOG.md`](CHANGELOG.md) | What changed and when (written so another AI can review it) |

## What works in the prototype

| Feature | Status |
|---|---|
| Sign in / create account / reset password, with cloud sync of your whole wardrobe | ✅ |
| Closet grid in boutique product cards, with filters and a placeholder-basics catalog | ✅ |
| Upload → on-device background removal + color reading → **AI vision tagging** → confirm sheet | ✅ |
| "Start with 1 photo" onboarding that fills the rest of the look with basics | ✅ |
| Dressing Room: 4:5 stage (flat-lay / mannequin / scene / **on you**), slot pickers, spec sheet | ✅ |
| Four-pillar **AI stylist critique**, grounded in the rules engine, + one-click swap tip | ✅ |
| Context parser ("Rainy Tuesday coffee meeting, 16°C") | ✅ |
| Mix & Match: **the AI stylist builds 3 outfits from your closet** (anchor lock); rules engine fallback | ✅ |
| Scenes: soft-focus backdrops (photo slots for Gemini images), or upload your own background | ✅ |
| Lookbooks & trips with versatility score and packing list | ✅ |
| Read-only share links (the lookbook is encoded in the URL) | ✅ |
| Inspiration Bridge: upload a screenshot → **the AI lists the pieces** → "You own 75% of this look" | ✅ |

Your closet saves in the browser, and **syncs to your account when you sign in** (Supabase, shared with Tiffo).
The **AI stylist (Google Gemini via Puter.js)** powers tagging, critiques, Mix & Match and inspiration matching. **No API key**: each user signs in to a free Puter account the first time. The rules engine is the fallback.
Real photos (e.g. from Gemini) can replace the built-in renders at any time.

**One-time setup:** [`SETUP.md`](SETUP.md) (accounts, the AI stylist, photos).

## Develop

```bash
cd unique-ava
npm install
npm run dev      # local dev server
npm test         # rules-engine unit tests (Vitest)
npm run build    # builds ONE self-contained file and copies it to ../unique-ava.html
```

## Where the "AI" lives

```
src/ai/
  critic.js       four-pillar critique + swap suggestions (deterministic, tested)
  generator.js    3-variation outfit search with persona scoring and diversity
  context.js      free text → temperature, rain, occasion, season, city
  tagger.js       on-device cut-out + dominant color; simulated semantic tags
  inspiration.js  look decomposition + closet coverage matching
  color.js        color math (HSL, hue distance, neutrals)
```

Each module has the same inputs and outputs the production Edge Functions will have, so swapping a
mock for a real model is a one-import change.
