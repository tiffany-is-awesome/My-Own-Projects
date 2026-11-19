# Pantry to Plate

Recipes from every cuisine, made **only** from what's already in your kitchen. Nothing to buy: when a dish needs something you don't have, it swaps in what you do have.

Live site: https://tiffany-is-awesome.github.io/My-Own-Projects/pantry-to-plate/

## What's already set up

- **Accounts and syncing:** sign in, create an account, reset a password. Your kitchen, staples and saved recipes follow you to every device. They're stored in the `pantry_data` table in the Supabase project you share with Tiffo, and each person can only see their own data.
- **The AI helper:** a Supabase Edge Function called `pantry-ai` is deployed and waiting for a key. It keeps the key secret, and only signed-in users can use it.
- **Demo mode:** until the AI is switched on, the site shows built-in sample recipes and ready-made dish fixes, so everything can be clicked through.

## The one thing left: add an AI

Pick one and add its key in Supabase: **Edge Functions → Secrets → Add new secret**.

| Secret name | AI | Where to get the key |
|---|---|---|
| `ANTHROPIC_API_KEY` | Claude | https://console.anthropic.com (pay per use) |
| `GEMINI_API_KEY` | Google Gemini | https://aistudio.google.com (free tier) |

That's it. Reload the site: the badge at the top changes from **Demo mode** to **AI · Claude** or **AI · Gemini**.

Keep the key only in Supabase. Never put it in `index.html`, GitHub or a chat.

Optional extras:
- If both keys are set, Claude is used. Add `AI_PROVIDER` = `gemini` to switch.
- `PANTRY_ALLOWED_ORIGIN` = `https://tiffany-is-awesome.github.io` lets only your site call the helper.
- **Nicer email links:** in Supabase, go to **Authentication → URL Configuration → Redirect URLs** and add `https://tiffany-is-awesome.github.io/My-Own-Projects/pantry-to-plate/`. Without it, account confirmation still works, but the email link lands on Tiffo instead of here.

## How it's built

- One file: `index.html`. The settings are in the `CONFIG` block near the top of the script. The key there is Supabase's **publishable** key, which is safe to be public.
- Every AI request goes through the `AI PROVIDER` block. Inside claude.ai it uses Claude directly. On this site it calls the `pantry-ai` function.
- The AI helper's code is in [`supabase/functions/pantry-ai/index.ts`](../supabase/functions/pantry-ai/index.ts), and the table setup is in [`supabase/pantry-setup.sql`](../supabase/pantry-setup.sql).
