# Wearwise: audit & development plan

Written against the owner's brief *"Wearwise: Product Improvement & Development Plan"* (Nov 19, 2026).
Central promise: **find the perfect outfit without turning your closet upside down.**

---

## Part 1: Audit of what exists today (checked, not assumed)

How it was checked: read every source file; ran the 11 unit tests; drove the built app in a headless browser;
checked the **live site** (GitHub Pages) in a real browser on Nov 19.

### Works (verified)
| Feature | Evidence |
|---|---|
| Site loads; header shows **Gemini · Sign in** (Puter script loads) | live site |
| Private data: anonymous visitors **cannot** read the wardrobe table (HTTP 401) | live request against Supabase |
| Sign-in / sign-up / reset / cloud sync logic | browser tests against a simulated Supabase |
| On-device photo cut-out + color reading | browser test with a "messy" photo |
| AI tagging, critique, outfit picks, inspiration reading through Gemini/Puter | browser tests with a stand-in for Puter |
| Rules engine: weather/warmth, rain-unsafe shoes, color harmony, proportions, formality | 11 unit tests |
| Fitted mannequin, flat-lay renders, lookbooks, trip versatility, share links | screenshots / browser tests |

### Not yet verified for real
- **A real Gemini call**: Puter needs a person's own sign-in, so no live AI answer has been seen yet.
- **A real account sign-up** (confirmation email → sign in → sync).

### Problems found (measured against the brief)
| # | Problem | Brief section |
|---|---|---|
| P1 | **Hardcoded sample wardrobe.** Every new visitor gets 22 sample clothes, 2 sample lookbooks and 4 sample inspirations as if they were theirs. | §13 "no hardcoded sample wardrobes" |
| P2 | **Recommends clothes the user doesn't own.** "Placeholder basics" appear in Mix & Match, swap tips and onboarding. | §4, §8 |
| P3 | **Fake-AI signals.** A "Generate" scene button only picks a preset; the keyword parser is labelled "AI read it as"; without AI, upload tagging guesses the category from the file name. | §11, §13 |
| P4 | **Can't edit a piece after adding it**; can't add without a photo; one photo at a time. | §3 |
| P5 | **Missing categories/attributes:** no dresses, hats, jewelry; no *style* or *sleeve length*. | §3 |
| P6 | **Filters:** only category + season (no color, style, occasion). | §3 |
| P7 | **Outfit generator input** is free text only; occasions miss school, church, party, vacation, sports; no style / weather / preference chips. | §4 |
| P8 | **Quality checks** cover color, proportion, occasion, weather; **missing** style consistency, accessories, comfort; footwear only partly. | §4 |
| P9 | **Explanations** only when the AI runs; the offline fallback shows pros/cons but no plain-language "why". | §4 |
| P10 | **Alternatives:** a single swap tip instead of "different shoes / add a jacket / more formal / more casual / add accessories / more colorful". | §4 |
| P11 | **Saved outfits** live only inside lookbooks; a saved outfit can't be deleted; no favorites. | §4 Phase 1 #8 |
| P12 | **Navigation** doesn't make *Create an Outfit* the obvious action; the generator (Mix & Match) and builder (Dressing Room) are separate pages. | §10 |
| P13 | **Privacy:** no way to delete your data. | §11 |

Keep (good, works): boutique look, closet grid, on-device cut-out, rules engine, fitted mannequin + flat-lay,
Supabase accounts + RLS, Puter/Gemini AI layer with rules fallback, lookbooks & trips, share links, photo slots.

Note on AI keys (§11): Gemini runs through Puter.js, so **there is no API key in the frontend or anywhere else**.
Each user signs in to Puter, and her requests are authorized by her own Puter session.

---

## Part 2: Plan

### PHASE 1: Core experience (building now)

#### 1A · A real wardrobe (fixes P1, P2, P3)
- **What:** new users start with an **empty closet**. The sample closet becomes an opt-in **"Try the demo closet"**: every item is
  badged *Demo*, and one tap removes them all. Recommendations, alternatives and swaps use **only owned, available items**.
  Placeholder basics are removed from recommendations. Labels say what's really AI and what isn't. The fake "Generate" scene button is removed.
- **Why:** the brief's core rule is to use the clothes she actually owns, and never fake AI.
- **Looks like:** empty closet → a large "Add your first piece" area and a quiet "or try the demo closet" link.
- **Technical:** store starts empty; `demo: true` flag on sample items; generator pool = owned and not demo-hidden; remove `BASICS` from recommendation paths.
- **Test:** fresh browser → closet empty; generate with nothing → friendly "add a top, bottom and shoes first"; demo on/off.

#### 1B · Adding & editing clothes (fixes P4, P5, P6)
- **What:** upload **several photos at once** (or take one with the phone camera); each is cut out, color-read and tagged by Gemini,
  then shown in a review list to confirm or correct. **Add without a photo** (manual form). **Edit any piece** later. New categories:
  **dresses, hats, jewelry, belts** (bags stay under accessories). New attributes: **style** (casual, minimalist, elegant, classic,
  streetwear, preppy, sporty, feminine, edgy, business casual), **sleeve length**, **occasions**.
  Filters: category, **color**, **style**, **occasion**, season.
- **Technical:** batch upload queue; tag prompt asks for style, sleeve and occasions; dress is a full-outfit piece (replaces top + bottom)
  in the critic, generator, flat-lay and mannequin; hats and necklaces drawn on the mannequin.
- **Test:** add 3 photos at once → 3 review cards; correct a category → saved; edit an existing piece; filter by color "black".

#### 1C · Create an Outfit (fixes P7–P10)
- **What:** one screen, one obvious button. Quick chips with sensible defaults: **Occasion** (everyday, school, work, church,
  date, party, wedding, vacation, sports, special), **Style**, **Weather** (hot, warm, cool, cold, rainy), **Preferences**
  (comfortable, more formal, more colorful, simple, stand out), and an optional **"wear this piece"**. Tap **Create** → 3 outfits from her closet.
  Each has a **plain-language explanation** and **alternatives she owns**: different shoes, replace the top, add a jacket,
  more formal, more casual, add an accessory, more colorful. Each is one tap to preview and ♥ to save.
- **Quality:** the rules engine gains **style consistency, footwear, accessories and comfort** checks, on top of color, proportion,
  occasion and weather. Gemini (when signed in) picks and explains; the rules engine verifies and always provides an explanation.
- **Technical:** structured context → generator + critic; `alternatives()` searches owned items per goal; explanation writer for
  the offline path; Gemini prompt receives the chips.
- **Test:** unit tests for each alternative type and the new checks; browser: chips → 3 outfits → alternatives → save.

#### 1D · Saved outfits, navigation, privacy (fixes P11–P13)
- **Navigation:** **Home · My Closet · Create an Outfit · Saved Outfits · Settings**. *Create an Outfit* is highlighted and also on
  Home. The builder (stage + spec sheet) opens from any outfit. Lookbooks/trips and Inspiration stay inside Saved Outfits.
- **Saved Outfits:** favorites ♥, delete a saved outfit, lookbooks/trips as before.
- **Settings:** account, AI (Gemini sign-in), **Delete all my Wearwise data** (local + cloud row).
- **Test:** save → appears; delete → gone (and from lookbooks); delete-my-data → closet empty locally and in the cloud.

#### 1E · Family members & family looks (owner request, Nov 19)
- **What:** one sign-in holds several wardrobes, e.g. *Me*, *Dad*, *Mia (child)*. A switcher at the top changes whose closet,
  outfits and saved looks are shown. Add, rename or remove members; choose adult or child (children shown on a smaller mannequin).
  **Family look:** pick who's going + occasion + weather → each person gets an outfit from **their own** closet, chosen so
  the group looks coordinated (shared or complementary palette, same level of dressiness, no clashing accent colors).
  Everyone is shown side by side with an explanation; the family look can be saved.
- **Technical:** `profiles[]` and `ownerId` on every piece, `profileId` on outfits/lookbooks, `ensembles[]` for saved family looks.
  Ensemble search: top candidate outfits per person from the rules engine, then the combination with the best
  individual scores + coordination score (palette harmony across people, formality spread). Existing data migrates to the "Me" member.
- **Test:** add a child member → empty closet; add pieces → only hers appear; family look for 3 members uses each member's own
  clothes only; coordination prefers a shared accent color.

### PHASE 2: Smart wardrobe (next)
Laundry/availability status (clean, laundry, wearing, unavailable; never recommended when unavailable) · **Rediscover My Closet**
(pieces not used in recent plans + 3 new outfits each) · outfit feedback (loved it / comfortable / didn't work / would wear again)
feeding the generator's scores · personalization from feedback.

### PHASE 3: Outfit planning
Outfit calendar (assign saved outfits to days, repetition warning) · event planning · **live weather** (Open-Meteo, no key) ·
packing assistant (reuses trip lookbooks + versatility) · repetition awareness.

### PHASE 4: Advanced AI styling
Conversational **Style Assistant** using her real wardrobe (Gemini via Puter) · deeper style analysis · drag-and-drop builder ·
optional AI model previews, clearly labelled as approximations, never altering the real garment's color or pattern.

### Needs from the owner
- **Phase 1:** nothing extra. Gemini via Puter needs no key.
- **One real test:** sign in to Puter once on the live site to confirm a real Gemini answer.
- **Later (optional):** real product photos to replace renders (prompts in `GEMINI-PHOTO-PROMPTS.md`).
