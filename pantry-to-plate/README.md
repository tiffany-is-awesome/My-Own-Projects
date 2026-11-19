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

- One file: `index.html`. The settings are in the `CONFIG` block near the top of the script. The key there is Supabase's **publishable** key, which is safe to be public.
- Every AI request goes through the `AI PROVIDER` block: Claude inside claude.ai; on this site, your `pantry-ai` function if it has a key, otherwise free Gemini through Puter.
- The AI helper's code is in [`supabase/functions/pantry-ai/index.ts`](../supabase/functions/pantry-ai/index.ts), and the table setup is in [`supabase/pantry-setup.sql`](../supabase/pantry-setup.sql).
