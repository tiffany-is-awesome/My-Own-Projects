# Unique Ava: UX/UI Spec & Product Roadmap

> The feel: **your closet as a quiet, well-run boutique.** Every garment gets a clean product card;
> every outfit gets a spec sheet. No clutter, no collage chaos, no flattery.

---

## Part A: Design system

### A1. Principles

1. **Product, not post.** Garments are shown like e-commerce items (centered, generous padding, light
   gray stage) instead of Pinterest-style scraps.
2. **Spec over adjectives.** Information shows up as labeled rows, meters and short facts, the way a
   good product page does.
3. **One accent, used sparingly.** Red marks only primary actions and the "AI" mark. Everything else
   is black, white and gray.
4. **Honest by design.** The critic always shows *both* pros and cons. A perfect score is rare and earned.

### A2. Tokens

| Token | Value | Use |
|---|---|---|
| `--ink` | `#1B1B1B` | Text, primary buttons |
| `--ink-2` | `#5F5F5F` | Secondary text |
| `--ink-3` | `#9A9A9A` | Meta, placeholders |
| `--line` | `#E3E3E3` | Hairlines, card borders |
| `--stage` | `#F4F4F4` | Product card backgrounds, visual stage |
| `--paper` | `#FFFFFF` | Page |
| `--accent` | `#D3121B` | Primary CTA, AI badge, "new" |
| `--good` | `#2F7D4F` | Pros |
| `--warn` | `#B5621B` | Cons |
| Font | Inter / system sans; 700 for headings, uppercase + 0.08em tracking for labels | |
| Type scale | 11 / 13 / 15 / 20 / 28 / 40 px | |
| Radius | **0** for cards & buttons (crisp retail look); 999px only for chips | |
| Spacing | 4-pt grid: 4, 8, 12, 16, 24, 32, 48, 64 | |
| Grid | 12 columns, 24px gutter desktop; closet cards 4-up desktop, 3-up tablet, 2-up mobile | |
| Motion | 150ms ease-out; no bounces | |

### A3. Core components

* **Product card**: 4:5 stage (`--stage`), garment cut-out centered at 78% height; below it the name
  (13px/600), a meta line ("Cotton twill · Mid weight") and color swatches. Hovering reveals
  "+ Add to look".
* **Spec row**: uppercase label left, value right, hairline between rows. Used for Season, Weather,
  Formality, Versatility.
* **Meter**: 5-segment bar (Formality, Warmth). Filled segments in `--ink`.
* **Pillar block**: pillar name + 0–100 score + ✓ pros / △ cons lists.
* **Chip**: pill filter (category, season, color). Active = filled ink.
* **Placeholder tag**: dashed border + "BASIC" label on non-owned catalog items.

---

## Part B: Information architecture

```
Top bar:  UNIQUE AVA   Closet   Dressing Room   Mix & Match   Lookbooks   Inspiration      [+ Add item]
```

| Screen | Job to be done |
|---|---|
| **Closet** | See everything I own as a tidy catalog; filter; add items |
| **Dressing Room** | Build or tweak one outfit; see it on a stage; get an honest critique; save it |
| **Mix & Match** | "Dress me for this situation" → 3 options in seconds |
| **Lookbooks** | My saved collections and trips; versatility; share |
| **Inspiration** | "How close am I to this look?" |
| **Shared lookbook** (public) | Read-only, beautiful, no sign-in needed |

---

## Part C: Key flows

### C1. First run (target: first outfit critique in under 90 seconds)

1. **Welcome**: "Your wardrobe, curated." → *Start with 1 photo* / *Explore the sample closet*.
2. **Upload 1–2 items**: drag/drop or camera. Progress steps are shown honestly:
   `Removing background → Reading colors → Tagging`.
3. **Confirm tags sheet**: the AI's guess is shown as editable chips. One tap on "Looks right".
4. **"Complete the look with basics"**: Unique Ava suggests placeholder basics (dark jeans, white sneakers,
   white tee…) to fill empty slots. Each is clearly marked BASIC.
5. **Land in the Dressing Room** with the first outfit already critiqued.

### C2. Dressing Room (split screen)

```
┌──────────────────────────────┬─────────────────────────────────┐
│  [Flat-lay] [Mannequin] [Scene]│  LOOK 01 · Untitled             │
│  ┌────────────────────────┐  │  ────────────────────────────── │
│  │                        │  │  CONTEXT   Rainy · 16°C · Café  │
│  │     4:5 visual stage   │  │  SEASON    Spring / Autumn      │
│  │                        │  │  WEATHER   ●●●●○  Good          │
│  │                        │  │  FORMALITY ●●●○○  Smart casual  │
│  └────────────────────────┘  │  ────────────────────────────── │
│  Slots: TOP  BOTTOM  OUTER  SHOES  ACC                          │
│  (tap a slot → picker drawer)│  STYLIST CRITIQUE      78 / 100 │
│                              │  ▸ Proportions   ✓ … △ …        │
│                              │  ▸ Fabric & Wx   ✓ … △ …        │
│                              │  ▸ Color         ✓ …            │
│                              │  ▸ Occasion      ✓ … △ …        │
│                              │  SWAP TIP  Try the leather boots│
│                              │  [ SAVE TO LOOKBOOK ]           │
└──────────────────────────────┴─────────────────────────────────┘
```

* Changing any slot re-runs the critique instantly (rules engine, no wait).
* Swap tips are actionable: one click applies the suggested swap.
* Mobile: stage on top (sticky, 60vh), spec sheet scrolls beneath.

### C3. Mix & Match

1. Prompt field with example chips: *Rainy Tuesday coffee meeting, 16°C* · *Beach café, 30°C* ·
   *Office presentation, 22°C* · *Kyoto temples in autumn*.
2. Optional **anchor**: "Build around…" picker (locks one item).
3. Three cards: **Safe & Classic**, **Layered & Cozy**, **Smart Casual**, each with mini flat-lay,
   score and the single strongest pro + con.
4. "Open in Dressing Room" or "Save".

### C4. Lookbooks & trips

* Create a **collection** ("Spring Rotation") or a **trip** ("4-Day Kyoto Trip", with city + days).
* Trip view: day-by-day rows, a **Versatility Score**, and a **packing list** (unique items, grouped by
  category, with counts: "Black turtleneck × 3 days").
* **Share**: generates a read-only link. Shared page = cover, title, season, outfit grid with spec
  footers, *no* critique cons (the owner chooses what to show).

### C5. Inspiration Bridge

* Gallery of saved inspiration (user-pasted links/screenshots, with attribution).
* Opening one shows a split view: inspiration ↔ *"You own 80% of this look"* with the matched items
  from your closet, and a **Missing** row (Phase 3: tasteful "shop similar" links).
* "Recreate in Dressing Room" builds the outfit with your matches + placeholder basics for gaps.

### C6. Empty, loading and error states

| State | Copy / behavior |
|---|---|
| Empty closet | "Your boutique is empty. Add one piece and we'll fill the rest with basics." |
| Tagging low confidence | "We're not sure about the material. Is it **wool** or **acrylic**?" |
| AI unavailable | Critique still works (rules engine); the prose gets shorter, with a note "Detailed notes unavailable" |
| Upload failed | Keep the photo locally, offer Retry; never lose a user's image |

### C7. Accessibility

* All drag & drop has a click/keyboard alternative (slot pickers).
* Color names always accompany swatches (never color alone).
* Contrast ≥ 4.5:1 for text; focus rings visible (2px ink outline).
* Alt text auto-generated from tags: "Olive wide chino trousers, cotton twill".

---

## Part D: Product roadmap

### Phase 0: Prototype ✅ (this repo, now)
Clickable front end with mock AI and a real rules engine: Closet, Dressing Room, Mix & Match, critic,
Lookbooks with versatility, Inspiration matching against sample looks, upload with on-device color
reading. **Goal:** feel the product and test the flow with 5–10 friends.

### Phase 1: MVP: "My closet, honestly critiqued" (≈ 6–8 weeks part-time)

| Week | Deliverable |
|---|---|
| 1 | Supabase project, schema + RLS, auth (reuse Tiffo setup guide) |
| 2 | Upload pipeline: EXIF strip, in-browser background removal, color extraction, Storage |
| 3 | `unique-ava-ai` Edge Function: tagging with JSON schema + confirm sheet |
| 4 | Closet grid with filters, edit item, placeholder basics catalog |
| 5 | Dressing Room flat-lay builder, critic wired to real data, Claude critique layer |
| 6 | Mix & Match (3 variations, anchor lock), Open-Meteo weather |
| 7 | Save outfits, simple lookbooks (private), onboarding flow |
| 8 | Polish, Playwright tests, beta invite |

**Exit criteria:** 20 beta users, ≥ 60% add ≥ 5 items, tag accept-without-edit ≥ 70%, critique rated
"useful" ≥ 4/5.

### Phase 2: "See it for real" (≈ 6–10 weeks)
* Flat-lay clean-up (de-wrinkle / relight) as an optional "Studio finish" per item.
* Scene staging: AI backgrounds (presets + prompt) and user-uploaded backgrounds, with real cut-outs composited on top.
* Mannequin mode (cheap overlay), then virtual try-on (premium, cached, capped).
* Inspiration Bridge: paste link/screenshot → decompose → pgvector match → coverage.

**Exit criteria:** ≥ 40% of saved outfits use a scene; generated-image cost per active user < $0.50/mo.

### Phase 3: "Share & plan" (≈ 4–6 weeks)
* Public lookbook links with OG preview images.
* Trip planner: city + dates → forecast per day → auto-suggested daily outfits → packing list +
  versatility score.
* "Missing staples" recommendations with affiliate links. Rules: max 1 per screen, always labeled
  "Affiliate", never in the critique itself, and only for gaps the user's closet genuinely has.
* Premium plan (try-on, unlimited scenes, more trips).

### North-star & guardrail metrics

| Metric | Why |
|---|---|
| **Weekly outfits planned per active user** (north star) | Measures real daily usefulness |
| Closet completeness (items added in first 14 days) | Onboarding health |
| % critiques followed by a swap | Is the critic actionable? |
| Share-link opens per shared lookbook | Organic growth loop |
| AI cost per weekly active user | Keeps the business viable |
| Tag correction rate | Model quality |

### Open questions to test in Phase 0
1. Do people prefer flat-lay or mannequin as the *default* stage?
2. Is a numeric score motivating or off-putting? (Alternative: just pros/cons.)
3. How many placeholder basics feel helpful before it stops feeling like *my* closet?
4. Would people pay for try-on, or is a good flat-lay + scene enough?
