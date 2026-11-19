# Pantry to Plate

Recipes from every cuisine, made **only** from what's already in your kitchen. Nothing to buy: when a dish needs something you don't have, it swaps in what you do have.

Live site: https://tiffany-is-awesome.github.io/My-Own-Projects/pantry-to-plate/

## What's already set up

- **Accounts and syncing:** sign in, create an account, reset a password. Your kitchen, staples and saved recipes follow you to every device. They're stored in the `pantry_data` table in the Supabase project you share with Tiffo, and each person can only see their own data.
- **The AI helper:** a Supabase Edge Function called `pantry-ai` is deployed and uses Google Gemini's free tier. Users just sign in to use it; the key stays secret in Supabase.
- **Demo mode:** until the AI is switched on, the site shows built-in sample recipes and ready-made dish fixes, so everything can be clicked through.

## The one thing left: add a free Gemini key (once, by you)

App users never need a key. They just sign in. The key is yours, stays hidden in Supabase, and covers everyone.

1. Go to https://aistudio.google.com, sign in with Google, click **Get API key → Create API key**, and copy it. No credit card needed; don't link billing and it stays free.
2. In Supabase, go to **Edge Functions → Secrets → Add new secret**: name `GEMINI_API_KEY`, value = your key. Save.
3. Reload the site. The badge at the top changes from **Demo mode** to **AI · Gemini**.

If you already added `GEMINI_API_KEY` for Tiffo, skip all this: secrets are shared across the project, so it already works.

Good to know:
- On Gemini's free tier, Google may use what's sent to improve its products. Pantry to Plate only sends ingredient lists and recipe requests.
- When the free daily limit is reached, the site falls back to sample recipes and quick fixes until it resets. You're never charged.
- Keep the key only in Supabase. Never put it in `index.html`, GitHub or a chat.
- To use Claude instead later: add `ANTHROPIC_API_KEY` plus `AI_PROVIDER` = `claude`.
- `PANTRY_ALLOWED_ORIGIN` = `https://tiffany-is-awesome.github.io` lets only your site call the helper.
- **Nicer email links:** in Supabase, go to **Authentication → URL Configuration → Redirect URLs** and add `https://tiffany-is-awesome.github.io/My-Own-Projects/pantry-to-plate/`. Without it, account confirmation still works, but the email link lands on Tiffo instead of here.

## How it's built

- One file: `index.html`. The settings are in the `CONFIG` block near the top of the script. The key there is Supabase's **publishable** key, which is safe to be public.
- Every AI request goes through the `AI PROVIDER` block. Inside claude.ai it uses Claude directly. On this site it calls the `pantry-ai` function.
- The AI helper's code is in [`supabase/functions/pantry-ai/index.ts`](../supabase/functions/pantry-ai/index.ts), and the table setup is in [`supabase/pantry-setup.sql`](../supabase/pantry-setup.sql).
