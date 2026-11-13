# Setting up Unique Ava online

Unique Ava works right away: your closet is saved in the browser and the built-in rules engine styles you.
These two one-time steps switch on **accounts** and **Claude**.

## 1. Accounts & cloud sync (5 minutes)
Unique Ava uses **the same free Supabase project as Tiffo**, so it's already connected.
Sign-ins are shared between the two apps; each app keeps its own private data.

1. Open your Supabase project → **SQL Editor** → **New query**.
2. Paste everything from [`supabase/unique-ava.sql`](../supabase/unique-ava.sql) and click **Run**.
   You should see "Success. No rows returned". ✅
3. **Authentication → URL Configuration → Redirect URLs** → **Add URL**:
   `https://tiffany-is-awesome.github.io/My-Own-Projects/unique-ava.html`
   (This makes "confirm your email" and "reset password" links come back to Unique Ava.)

**Test it:** open Unique Ava → **Sign in → New here? Create an account** → confirm the email → sign in.
Add a piece, then open the site on your phone and sign in. Your closet appears.
The account menu (top right) shows **☁️ Synced just now**.

> If the menu says **"Cloud not set up"**, step 2 hasn't been run yet.

## 2. Claude (10 minutes)
In the claude.ai preview Claude works with no setup (it uses your own Claude account).
For the live site, a small Supabase function holds your Anthropic key. **Only signed-in users can use it**,
and each user gets a daily limit, so strangers can't run up your bill.

1. Get an API key at **https://console.anthropic.com** → *API Keys* → *Create key*. Keep it secret.
2. Supabase → **Edge Functions → Deploy a new function** → name it `unique-ava-ai` → paste
   [`supabase/functions/unique-ava-ai/index.ts`](../supabase/functions/unique-ava-ai/index.ts) → Deploy.
   Leave **"Verify JWT"** on (the function also checks the sign-in itself).
3. **Edge Functions → Secrets** → add `ANTHROPIC_API_KEY` = your key.
   Recommended: `UNIQUE_AVA_ALLOWED_ORIGIN` = `https://tiffany-is-awesome.github.io` and `UNIQUE_AVA_DAILY_LIMIT` = `60`.
4. In [`unique-ava/src/config.js`](src/config.js) set
   ```js
   AI_PROXY_URL: 'https://hvhbygkgvxdpvwvclyns.supabase.co/functions/v1/unique-ava-ai',
   ```
   then rebuild (`cd unique-ava && npm run build`) and commit. Or just ask Claude to do this step.
5. Sign in on the live site. The header badge turns green: **Claude on**.

**Cost:** tagging a piece or writing a critique is roughly a cent or less on Claude's mid-size model;
Mix & Match sends your closet list, so it's a little more.

## 3. Photos (optional, any time)
Real photos (for example from Gemini) replace the built-in renders without a rebuild.
See [`unique-ava-photos/README.md`](../unique-ava-photos/README.md) and the prompts in
[`GEMINI-PHOTO-PROMPTS.md`](GEMINI-PHOTO-PROMPTS.md).
