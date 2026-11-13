# Atelier: AI personal stylist & digital wardrobe

Your closet, run like a clean, minimalist boutique. Photograph your clothes (however messy),
mix outfits for real weather and places, get an honest four-pillar critique, and save looks
into shareable lookbooks.

**Live app:** `atelier.html` at the repo root (GitHub Pages:
https://tiffany-is-awesome.github.io/My-Own-Projects/atelier.html)

| Doc | What's in it |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System design, tech stack, AI pipeline, database schema, APIs, costs, privacy |
| [`docs/UX-AND-ROADMAP.md`](docs/UX-AND-ROADMAP.md) | Design tokens, screens & flows, phased roadmap, metrics |

## What works in the prototype

| Feature | Status |
|---|---|
| Closet grid in boutique product cards, with filters and a placeholder-basics catalog | ✅ |
| Upload → on-device background removal + real color reading → tag confirm sheet | ✅ (tagging is simulated) |
| "Start with 1 photo" onboarding that fills the rest of the look with basics | ✅ |
| Dressing Room: 4:5 stage (flat-lay / mannequin / scene), slot pickers, spec sheet | ✅ |
| Four-pillar critic (proportions, fabric & weather, color, occasion) + one-click swap tip | ✅ real rules engine |
| Context parser ("Rainy Tuesday coffee meeting, 16°C") | ✅ |
| Mix & Match: 3 variations (Safe & Classic / Layered & Cozy / Smart Casual), anchor lock | ✅ |
| Scenes: preset backdrops, prompt-matched "AI scene", upload your own background | ✅ (generation is simulated) |
| Lookbooks & trips with versatility score and packing list | ✅ |
| Read-only share links (the lookbook is encoded in the URL) | ✅ |
| Inspiration Bridge: "You own 75% of this look", with matches and gaps | ✅ (look decomposition from text) |

Everything is saved in the browser (localStorage). There are no accounts or API keys yet; Phase 1 adds
Supabase + Gemini using the same setup as Tiffo (see `SETUP-ONLINE.md` in the repo root).

## Develop

```bash
cd atelier
npm install
npm run dev      # local dev server
npm test         # rules-engine unit tests (Vitest)
npm run build    # builds ONE self-contained file and copies it to ../atelier.html
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
