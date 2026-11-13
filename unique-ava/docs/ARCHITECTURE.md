# Unique Ava: System Architecture & Tech Stack

> **Unique Ava** is an AI personal stylist and digital wardrobe. You photograph your own clothes, and it
> turns them into a clean boutique catalog. Then it mixes outfits for real weather and places,
> critiques them honestly, and saves them into shareable lookbooks.
>
> This doc covers *how it's built*. For *what it looks like and when each piece ships*, see
> [`UX-AND-ROADMAP.md`](UX-AND-ROADMAP.md).

Last reviewed: November 2026. AI model names and prices change often, so every AI call sits behind one
small adapter. You can swap a provider without touching the app.

---

## 1. Guiding principles

1. **Claude is the stylist.** All language and vision work (tagging, critique, outfit picks, reading inspiration
   photos) uses Claude. Image *generation* (scenes, try-on) needs a dedicated image model, since Claude reads images but doesn't create them.
2. **Same stack as Tiffo.** This repo already runs Tiffo on GitHub Pages + Supabase + an Edge
   Function. Unique Ava reuses that setup, so you learn one stack and stay on free tiers for as long as possible.
3. **Rules first, LLM second.** Weather, fabric and color logic is deterministic code. It is fast, free,
   testable and never hallucinates. The language model *explains* those findings in a stylist's voice;
   it doesn't invent them. (The prototype already works this way. See `src/ai/critic.js`.)
4. **Do the cheap work on the device.** Background removal and dominant-color extraction run in the
   browser. Paid image AI is used only where it clearly adds value (flat-lay clean-up, scenes, try-on).
5. **Private by default.** Wardrobe photos are personal. Storage is private per user (Row Level
   Security), and only lookbooks that the user explicitly shares are public.

---

## 2. High-level architecture

```
┌──────────────────────────── Browser (GitHub Pages, static) ────────────────────────────┐
│  React SPA (Vite)                                                                       │
│   ├─ Closet · Dressing Room · Mix & Match · Lookbooks · Inspiration                     │
│   ├─ On-device: background removal (ONNX/WebGPU), dominant color, image resize/WebP     │
│   ├─ Rules engine: weather fit, fabric/weather clashes, color harmony, formality        │
│   └─ Local cache (IndexedDB) → works offline, syncs when signed in                      │
└───────────────┬───────────────────────────────────────────────┬─────────────────────────┘
                │ supabase-js (auth, CRUD, uploads)              │ fetch (signed-in only)
┌───────────────▼──────────────── Supabase ─────────────────────▼─────────────────────────┐
│  Auth (email / Google)   Postgres + RLS   Storage (private + public buckets)            │
│  Edge Functions (Deno):                                                                 │
│    unique-ava-ai        → tag garment · write critique · generate outfits · decompose look │
│    unique-ava-image     → flat-lay clean-up · scene generation · compositing · try-on      │
│    unique-ava-weather   → forecast lookup + cache (Open-Meteo, free, no key)               │
│    unique-ava-share     → public lookbook JSON + OG image for link previews                 │
│  pgvector            → garment embeddings for "you own 80% of this look"                │
└───────────────┬─────────────────────────────────────────────────────────────────────────┘
                │ server-side keys only
     ┌──────────▼──────────┐   ┌───────────────────┐   ┌──────────────────────┐
     │ Claude (text+vision)│   │ Try-on API        │   │ Affiliate feeds      │
     │ + image model (P2)  │   │ (FASHN / Vertex)  │   │ (Phase 3)            │
     └─────────────────────┘   └───────────────────┘   └──────────────────────┘
```

**Why this shape:** the front end stays a static site (free hosting, same as Tiffo). Every secret key
lives in Edge Functions, and Postgres RLS means even a bug in the client can't leak another user's closet.

---

## 3. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Front end | **React 18 + Vite**, plain CSS with design tokens | Fast builds; easy to output a single file for GitHub Pages (as the prototype does) |
| State | React context + `useReducer`; **TanStack Query** once a backend exists | Simple now, with good caching and optimistic updates later |
| Drag & drop | `@dnd-kit/core` | Accessible (keyboard + touch), small |
| Canvas / collage | HTML/CSS layering for flat-lay; `<canvas>` for export (PNG for sharing) | No heavy editor needed |
| Background removal | **`@imgly/background-removal`** (ONNX in-browser, WebGPU when available) | Free, private, no upload needed. ⚠️ Check its license (AGPL / commercial) before charging money. Fallback: a server-side model (e.g. BiRefNet/RMBG on a GPU host) |
| Auth / DB / Storage | **Supabase** (Postgres 15, RLS, Storage, Edge Functions) | Already used by Tiffo; free tier is generous |
| Vector search | **pgvector** in the same Postgres | No extra service for closet ↔ inspiration matching |
| LLM (text + vision) | **Claude** (Haiku for quick tasks, Sonnet by default) | Strong vision and reliable JSON. Inside claude.ai it runs on the viewer's own account; on GitHub Pages it goes through the `unique-ava-ai` Edge Function |
| Image editing / scenes (Phase 2) | A dedicated image model (e.g. Gemini image or FLUX) | Claude doesn't generate images, so scene backgrounds and flat-lay clean-up use an image model behind the same adapter |
| Virtual try-on | **FASHN API** or **Google Vertex AI Virtual Try-On** | Purpose-built garment → person models, about $0.06–0.08 per image (see §7) |
| Weather | **Open-Meteo** | Free, no API key, global |
| Hosting | **GitHub Pages** (`unique-ava.html`) | Same as Tiffo |
| Analytics / errors | PostHog (free tier) + Sentry (free tier) | Funnel + crash visibility |
| Tests | Vitest (rules engine), Playwright (critical flows) | The rules engine is pure functions, so it's easy to test |

---

## 4. The AI pipeline in detail

### 4.1 Closet onboarding ("messy photo → boutique card")

```
photo ──► resize to 1600px, strip EXIF/GPS (privacy) ──► background removal (browser)
      ──► dominant colors (k-means on opaque pixels, browser)
      ──► [optional, Phase 1.5] flat-lay clean-up (image-model edit: "straighten, de-wrinkle,
          even studio light, pure #F4F4F4 background, keep exact color & texture")
      ──► auto-tag (Claude vision → strict JSON schema, below)  ✅ built
      ──► user confirms or edits tags (1 tap) ──► save
```

**Tagging contract** (the model must return exactly this, validated with Zod before saving):

```json
{
  "name": "Olive Wide Chino Trousers",
  "category": "bottom",            // top | bottom | outer | shoes | accessory | dress
  "subcategory": "chinos",
  "colors": [{ "name": "olive", "hex": "#5B5F3A", "share": 0.92 }],
  "pattern": "solid",              // solid | stripe | check | floral | graphic | other
  "material": "cotton twill",
  "weight": "mid",                 // light | mid | heavy
  "warmth": 2,                     // 1–5
  "waterResistance": 1,            // 1–5
  "formality": 3,                  // 1 (lounge) – 5 (black tie)
  "seasons": ["spring", "autumn"],
  "fit": "relaxed",                // fitted | regular | relaxed | oversized
  "confidence": 0.86
}
```

Color hex comes from the **on-device pixel analysis**, not the LLM, because models are bad at exact
colors. The LLM supplies names and semantics. If `confidence < 0.6`, the UI asks the user to confirm.

**Cost control:** tag once per garment, never again. Embeddings (for matching) are computed at the
same time and stored.

### 4.2 The Stylist Critic (four pillars)

```
outfit + context ──► rules engine (deterministic)   ──► scores + structured findings
                                                         │
                                         Claude (grounded critique) ──► pros / cons / tip  ✅ built
```

| Pillar | Rules engine checks (examples) |
|---|---|
| **Proportions & Silhouette** | Oversized top + oversized bottom → "volume on volume"; cropped outer + long top; fitted + relaxed balance = pro |
| **Fabric & Weather** | Water resistance vs. rain probability; total warmth vs. feels-like temperature; suede/canvas in rain; linen + heavy wool weight clash |
| **Color Harmony** | Hue-wheel relationships (neutral base, analogous, complementary, triadic); number of non-neutral accents (>2 = busy); temperature clash (warm vs. cool) |
| **Occasion Fit** | Outfit formality spread (max − min > 2 = mismatch); target formality vs. occasion keywords |

The LLM receives *only* the rules engine's JSON plus garment names, and is told: "Explain these
findings in ≤ 2 sentences each. Do not add findings." This makes critiques honest, specific,
repeatable, and cheap (one small text call, or none at all on the free tier, since the rules engine
already writes usable sentences).

### 4.3 Context-aware Mix & Match ("3 variations")

1. Parse the prompt (`"Rainy Tuesday coffee meeting, 16°C"`) into `{temp, rain, occasion, formality,
   location}`. A simple keyword parser runs locally, and the LLM handles anything vague.
2. Optionally fetch the real forecast (Open-Meteo) if a city + date is given.
3. **Candidate search (deterministic):** enumerate top × bottom × shoes (+ outer if needed), with the
   anchor item locked. Score each combo with the critic (weighted by the variation's goal).
4. **Three personas** pick the top-scoring diverse result:
   *Safe & Classic* (max color-harmony + occasion), *Layered & Cozy* (prefers outerwear, warmth margin),
   *Smart Casual* (formality target +1). Diversity is enforced by penalizing shared items.
5. If the closet can't fill a slot, a **placeholder basic** from the built-in catalog is used and labeled
   "Basic". That's the onboarding workaround.

With fewer than 200 items this is milliseconds in the browser. Above that, prune per slot to the top 15
by single-item fit first.

### 4.4 Visual stage (Phase 2)

| Mode | How |
|---|---|
| Flat-lay | CSS grid composition of cut-outs (Phase 1, free) |
| Mannequin | Pre-rendered neutral mannequin + garment cut-outs warped to anchor points (cheap), or try-on API (premium) |
| Scene | Image model: generate background from prompt ("rainy Tokyo street, soft overcast light, 4:5"), then composite the flat-lay or try-on result with matched lighting |
| User background | User uploads office photo → stored privately → same compositing step |

Generated images are cached by `hash(outfit_items + scene_prompt)`, so they are never paid for twice.

### 4.5 Inspiration Bridge (Phase 2)

**Important legal note:** scraping fashion sites and street-style blogs typically breaks their terms
and copyright. The safe design:

* Users **paste a link or screenshot** they found (it's their personal reference, like saving a pin).
  Unique Ava stores the URL + a small thumbnail with attribution, not a re-hosted copy.
* Optional licensed sources: brand/retailer affiliate feeds (Phase 3), or partner creators.

**Matching:** Claude vision decomposes (✅ built) the look into items (`{category, color, material, fit}`). Each is
embedded and compared with the user's garments (pgvector cosine + hard filters on category). Coverage =
matched slots / total slots → *"You own 80% of this look. Missing: a crossbody bag."*

---

## 5. Data model (Postgres)

```sql
create extension if not exists vector;

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  home_city text,
  style_prefs jsonb default '{}'::jsonb,         -- e.g. favored fits, avoided colors
  created_at timestamptz default now()
);

create table garments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  category text not null check (category in ('top','bottom','outer','shoes','accessory','dress')),
  subcategory text,
  colors jsonb not null,                          -- [{name,hex,share}]
  pattern text, material text,
  weight text check (weight in ('light','mid','heavy')),
  warmth smallint check (warmth between 1 and 5),
  water_resistance smallint check (water_resistance between 1 and 5),
  formality smallint check (formality between 1 and 5),
  seasons text[] default '{}',
  fit text,
  image_original_path text,                       -- private bucket
  image_cutout_path text,                         -- private bucket (transparent PNG/WebP)
  embedding vector(768),
  tag_confidence real,
  wear_count int default 0,
  archived boolean default false,
  created_at timestamptz default now()
);
create index on garments (user_id, category);
create index on garments using hnsw (embedding vector_cosine_ops);

create table outfits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text,
  context jsonb,                                  -- {prompt,temp,rain,occasion,city,date}
  stage jsonb,                                    -- {mode:'flatlay'|'mannequin'|'scene', sceneId, bgPath}
  critique jsonb,                                 -- cached critic output + model/version
  score smallint,
  created_at timestamptz default now()
);

create table outfit_items (
  outfit_id uuid references outfits on delete cascade,
  garment_id uuid references garments on delete cascade,
  placeholder_key text,                           -- e.g. 'basic-dark-jeans' when not owned
  slot text not null,                             -- top|bottom|outer|shoes|accessory
  primary key (outfit_id, slot)
);

create table catalogs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text not null,
  kind text default 'collection' check (kind in ('collection','trip')),
  trip jsonb,                                     -- {city, start, end, days}
  cover_outfit_id uuid references outfits,
  share_slug text unique,                         -- null = private
  created_at timestamptz default now()
);

create table catalog_outfits (
  catalog_id uuid references catalogs on delete cascade,
  outfit_id uuid references outfits on delete cascade,
  day smallint,                                   -- for trips
  position smallint,
  primary key (catalog_id, outfit_id)
);

create table inspirations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  source_url text, thumb_path text, attribution text,
  decomposed jsonb,                               -- items the AI found
  match jsonb,                                    -- {coverage, matches[], missing[]}
  created_at timestamptz default now()
);

-- Row Level Security: owners only, everywhere
alter table garments enable row level security;
create policy "own garments" on garments for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- (same pattern for profiles, outfits, outfit_items via outfits, catalogs, catalog_outfits, inspirations)

-- Public lookbooks are served ONLY through the unique-ava-share Edge Function,
-- which reads by share_slug with the service role and returns a sanitized view
-- (no original photos, no EXIF, no other catalogs).
```

**Versatility Score** (trip catalogs):
`versatility = 1 − (unique_items / total_item_slots)`, shown as a percentage, plus "most-worn" and
"worn once" lists. Example: 4 days × 4 slots = 16 slots using 7 unique items → 56% versatile.

**Storage buckets**
* `closet-private`: originals + cut-outs, path `user_id/garment_id/*`, RLS by folder.
* `lookbook-public`: copies rendered at share time (watermark-free WebP, 1080px). Deleted when unshared.

---

## 6. API surface (Edge Functions)

All functions require a signed-in user (same pattern as `supabase/functions/tiffo-ai`), except
`unique-ava-share` GET.

| Endpoint | Input | Output |
|---|---|---|
| `POST /unique-ava-ai` `{task:"tag"}` | `{imageBase64 (cut-out, ≤1024px), colors}` | Tagging JSON (§4.1) + embedding |
| `POST /unique-ava-ai` `{task:"critique"}` | `{findings, garments, context}` | `{pillars:[{id,pros[],cons[]}], swapTip}` |
| `POST /unique-ava-ai` `{task:"parse-context"}` | `{prompt}` | `{temp, rain, occasion, formality, city, date}` |
| `POST /unique-ava-ai` `{task:"decompose"}` | `{imageBase64 \| url}` | `{items:[{category,color,material,fit}]}` |
| `POST /unique-ava-image` `{task:"flatlay"}` | `{garmentId}` | cleaned cut-out path |
| `POST /unique-ava-image` `{task:"scene"}` | `{prompt, aspect:"4:5"}` | scene image path (cached) |
| `POST /unique-ava-image` `{task:"tryon"}` | `{outfitId, avatarId}` | try-on image path (cached) |
| `GET /unique-ava-weather` | `?lat&lon&date` | `{tempC, feelsC, rainProb, wind}` (cached 1h) |
| `GET /unique-ava-share/:slug` | — | public lookbook JSON |

**Rate limits** (stored per user in a `usage` table): free plan = 30 tags/day, 20 critiques/day,
5 scenes/day, 0 try-ons. Limits are enforced in the function before any paid call.

---

## 7. Cost model (rough, Nov 2026)

| Action | Provider | Est. cost | Notes |
|---|---|---|---|
| Background removal | In-browser ONNX | $0 | First run downloads model (~40–80 MB), then cached |
| Auto-tag | Claude Sonnet (vision) | about a cent | One-time per garment; $0 inside claude.ai (viewer's plan) |
| Critique / Mix & Match | Claude Sonnet | about 1–3 cents | On request; rules engine is the free fallback |
| Flat-lay clean-up / scene | Image model (Phase 2) | ~$0.03–0.04 per 1K image | Cache aggressively |
| Virtual try-on | FASHN v1.6 / Vertex VTO | ~$0.06–0.08 per image | Premium-only feature |
| Storage | Supabase | free up to 1 GB | ~150 KB per WebP cut-out → ~6,000 garments |

**Per active user / month (heavy use):** 40 garments tagged, 60 critiques, 15 scenes, 0 try-ons,
about **$0.60**. With try-on (10/month) about **$1.30**. A $4–6/month premium tier covers it comfortably.

---

## 8. Security & privacy

* EXIF (incl. GPS) stripped on device **before** upload.
* Photos may contain faces/rooms: originals stay in a private bucket and are never sent to AI if the
  cut-out is enough (the tagger receives the cut-out, not the original).
* AI consent on first use (claude.ai asks the viewer before the page may use Claude; on GitHub Pages, show a notice since
  training). Paid tier → paid API with no-training terms.
* Share links are unguessable slugs, revocable, and serve sanitized copies only.
* Keys: Anthropic / image-model / try-on / affiliate keys are only ever Edge Function secrets.
* Account deletion cascades through every table and bucket folder.

---

## 9. Repo layout

```
My-Own-Projects/
├─ unique-ava.html                 ← built, single-file app (served by GitHub Pages)
└─ unique-ava/
   ├─ docs/ARCHITECTURE.md      ← this file
   ├─ docs/UX-AND-ROADMAP.md
   ├─ src/
   │  ├─ ai/                    ← rules engine + mock AI (swap for Edge Function calls later)
   │  │  ├─ critic.js           ← four-pillar critic
   │  │  ├─ generator.js        ← 3-variation outfit generator
   │  │  ├─ context.js          ← prompt → {temp, rain, occasion}
   │  │  ├─ tagger.js           ← mock tagger + real on-device color extraction & cut-out
   │  │  └─ inspiration.js      ← look decomposition + closet coverage
   │  ├─ data/                  ← sample closet, placeholder basics, scenes, inspiration looks
   │  ├─ components/ · views/   ← UI
   │  └─ styles.css             ← design tokens
   ├─ package.json · vite.config.js
   └─ README.md
```

**Going from prototype to real:** each file in `src/ai/` exports async functions with the same
signatures the Edge Functions will have. Replacing a mock means changing one `import`.

---

## 10. Key risks

| Risk | Mitigation |
|---|---|
| Tagging errors annoy users | One-tap confirm sheet; on-device color is ground truth; learn from corrections |
| Generated scenes look fake / alter garments | Never let the image model redraw garments: generate the background only, composite real cut-outs on top |
| Try-on costs explode | Premium only, cached, daily cap |
| Inspiration copyright | User-supplied references only, no scraping, attribution kept |
| In-browser model too heavy on old phones | Detect WebGPU/memory; fall back to server removal or "skip, use as is" |
