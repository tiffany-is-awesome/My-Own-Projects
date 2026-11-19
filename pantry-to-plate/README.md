# Pantry to Plate

Recipes from every cuisine, made **only** from what's already in your kitchen. Nothing to buy: when a dish needs something you don't have, it swaps in what you do have.

Live site: https://tiffany-is-awesome.github.io/My-Own-Projects/pantry-to-plate/

## ⚠️ Needed for sign-in to work for everyone

Supabase's built-in email service only sends emails to **members of your Supabase team**. Anyone else who signs up gets "Email address not authorized" and never receives the confirmation email. Fix it in one of two ways:

- **Quick (5 minutes):** Supabase → **Authentication → Sign In / Providers → Email** → turn **off "Confirm email"**. People can sign up and sign in straight away. Password-reset emails still won't reach non-team addresses.
- **Proper (about 20 minutes, free):** set up a free email-sending service such as Resend or Brevo, and enter its details under **Authentication → Emails → SMTP Settings**. Then confirmation and password-reset emails reach everyone.

## What's already set up (nothing left to do)

- **Free AI with no API key:** recipes and dish fixes come from Google's Gemini through [Puter](https://docs.puter.com). Nobody needs a key, not you and not your users. The first time someone asks for recipes, they tap **Connect free AI** and sign in to a free Puter account. Their AI use comes out of that account's free allowance, and you're never charged.
- **Accounts and syncing:** sign in, create an account, reset a password. Your kitchen, staples and saved recipes follow you to every device. They're stored in the `pantry_data` table in the Supabase project you share with Tiffo, and each person can only see their own data.
- **Demo mode** only appears if the AI can't load at all. It shows built-in sample recipes, so everything can still be clicked through.

Good to know:
- Puter is a separate service from Google. Puter's free allowance has limits; heavy users can top up their own Puter account.
- What's sent to the AI is just ingredient lists and recipe requests.

## Optional: your own Gemini or Claude key instead

The `pantry-ai` Supabase function is deployed and unused until a key is added. If you ever add `GEMINI_API_KEY` (free, https://aistudio.google.com) in **Supabase → Edge Functions → Secrets**, the site switches to it automatically, and users only need their site account, with no Puter sign-in. `ANTHROPIC_API_KEY` plus `AI_PROVIDER` = `claude` uses Claude instead.

Also optional: **nicer email links.** In Supabase, go to **Authentication → URL Configuration → Redirect URLs** and add `https://tiffany-is-awesome.github.io/My-Own-Projects/pantry-to-plate/`. Without it, account confirmation still works, but the email link lands on Tiffo instead of here.

## How it's built

`index.html` is the whole site in one file. It's **built** from the readable source in [`src/`](src/):

| File | What it does |
|---|---|
| `src/engine.js` | The "brain", no AI needed: ingredients, units, freshness and food-safety rules, recipe matching, ranking, swaps, and updating the kitchen after cooking. |
| `src/recipes.js` | The curated library: 36 meals (17 Filipino) and 12 drinks (smoothies, shakes, fresh juices), with exact amounts, essential vs optional ingredients, explained swaps, storage and reheating. |
| `src/app.js` | The screens: Home, My kitchen, Cook something, "I made this", Saved. |
| `src/ai.js` | Settings and the AI connection (Claude in claude.ai, free Gemini through Puter, or your own key via the `pantry-ai` Supabase function). |
| `src/cloud.js` | Sign-in and syncing with Supabase. |
| `src/plate.js`, `src/fix.js`, `src/status.js`, `src/boot.js` | Dish drawings, Rescue My Dish fixes, the AI badge, and startup. |
| `src/base.css`, `src/extra.css`, `src/body.html` | Look and page structure. |
| `src/test-engine.js` | The brief's acceptance tests: `node src/test-engine.js` |
| `src/test-audit.js` | The Phase 1 completion audit (modes, maths, deductions, leftovers, freshness, ranking): `node src/test-audit.js` |
| `src/test-scenarios.js` | The main-branch review's test scenarios (leftover dates, batches, missing amounts, scaling, best-before vs use-by): `node src/test-scenarios.js` |
| `src/test-browser-scenarios.py` | The same scenarios clicked through in a real browser with Playwright, on desktop and phone sizes (uses stand-ins for Supabase and Puter) |

After changing anything in `src/`, run `python3 src/build.py` to rebuild `index.html`.

### Food-safety rules
Freshness times are deliberately at the short end of public guidance: the USDA / FoodSafety.gov cold-storage chart (fridge at 4°C / 40°F or colder; freezer times are for quality, since frozen food stays safe), and the UK Food Standards Agency for cooked rice (eat within 24 hours, reheat once). Printed use-by dates always win. Cooked or perishable food with an unknown history is never called safe, and it's left out of recipes.

## Recipe photos

Dishes show a drawn illustration until a real photo is added. To add one:
1. Put the image in `img/` (about 800×1000, WebP or JPG, under 120 KB). It must show **this exact dish**.
2. Use your own photo, a free-licence photo (Unsplash, Pexels) with credit, or an AI image marked as AI.
3. Add a line to `PHOTOS` in `src/recipes.js`, for example
   `"chicken-adobo": { src: "img/chicken-adobo.webp", credit: "Photo: Jane Doe / Unsplash" }`
   or `{ src: "img/x.webp", ai: true }`, then run `python3 src/build.py`.
If a photo fails to load, the illustration stays.

## Recipe feedback

The **This didn't work** button on a recipe saves the reason on the device and, when signed in, to the `pantry_feedback` table in Supabase (people can add reports but can't read anyone's). Recipes reported as not working are ranked lower for that person.
