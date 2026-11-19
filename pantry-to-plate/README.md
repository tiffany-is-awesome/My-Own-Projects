# Pantry to Plate

Recipes from every cuisine, made **only** from what's already in your kitchen. Nothing to buy: when a dish needs something you don't have, it swaps in what you do have.

Live site: https://tiffany-is-awesome.github.io/My-Own-Projects/pantry-to-plate/

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
| `src/recipes.js` | The curated library of 26 dependable recipes with exact amounts, essential vs optional ingredients, explained swaps, storage and reheating. |
| `src/app.js` | The screens: Home, My kitchen, Cook something, "I made this", Saved. |
| `src/ai.js` | Settings and the AI connection (Claude in claude.ai, free Gemini through Puter, or your own key via the `pantry-ai` Supabase function). |
| `src/cloud.js` | Sign-in and syncing with Supabase. |
| `src/plate.js`, `src/fix.js`, `src/status.js`, `src/boot.js` | Dish drawings, Rescue My Dish fixes, the AI badge, and startup. |
| `src/base.css`, `src/extra.css`, `src/body.html` | Look and page structure. |
| `src/test-engine.js` | The brief's acceptance tests, run in code: `node src/test-engine.js` |

After changing anything in `src/`, run `python3 src/build.py` to rebuild `index.html`.

### Food-safety rules
Freshness times are deliberately at the short end of public guidance: the USDA / FoodSafety.gov cold-storage chart (fridge at 4°C / 40°F or colder; freezer times are for quality, since frozen food stays safe), and the UK Food Standards Agency for cooked rice (eat within 24 hours, reheat once). Printed use-by dates always win. Cooked or perishable food with an unknown history is never called safe, and it's left out of recipes.
