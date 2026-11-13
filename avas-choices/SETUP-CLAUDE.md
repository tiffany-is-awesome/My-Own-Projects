# Turning on Claude for Ava's Choices

Ava's Choices uses **Claude** for four things:

| Feature | What Claude does |
|---|---|
| ✨ Photo tagging | Looks at each uploaded piece and fills in name, category, fabric, warmth, formality, seasons |
| 🧥 Stylist critique | Writes an honest four-pillar critique, grounded in the app's warmth and rain math |
| 🌦️ Mix & Match | Reads "Rainy coffee meeting, 16°C" and builds 3 outfits from **your** closet |
| 📸 Inspiration | Reads a screenshot of a look and lists each piece, then matches it to your closet |

## Option A: inside claude.ai (no setup)
Open the published preview in Claude. The first time it uses AI, Claude asks you to allow it.
It runs on **your own Claude account**, so there are no keys and no bills.

## Option B: on GitHub Pages (about 10 minutes)
The public site can't hold a secret key, so a tiny Supabase function holds it for you.
(If you already set up Supabase for Tiffo, reuse the same project.)

1. Get an API key at **https://console.anthropic.com** → *API Keys* → *Create key*. Keep it secret.
2. In your Supabase project: **Edge Functions → Deploy a new function**, name it `avas-ai`,
   and paste in [`supabase/functions/avas-ai/index.ts`](../supabase/functions/avas-ai/index.ts).
   - Turn **off** "Verify JWT" for this function (visitors aren't signed in).
3. **Edge Functions → Secrets** → add `ANTHROPIC_API_KEY` = your key.
   Recommended: also add `AVAS_ALLOWED_ORIGIN` = `https://tiffany-is-awesome.github.io`
   and `AVAS_DAILY_LIMIT` = `60` (calls per visitor per day, which protects your bill).
4. Copy the function URL (looks like `https://abcdefgh.supabase.co/functions/v1/avas-ai`)
   and your project's **publishable key**, then put them in `avas-choices/src/config.js`:
   ```js
   AI_PROXY_URL: 'https://abcdefgh.supabase.co/functions/v1/avas-ai',
   SUPABASE_ANON_KEY: 'sb_publishable_xxxxxxxx',
   ```
   Or just send both values to Claude and ask it to switch them on.
5. Rebuild (`cd avas-choices && npm run build`) and commit. The header badge turns green: **Claude on**.

**Cost:** tagging a piece or writing a critique uses roughly a cent or less on Claude's mid-size model.
Mix & Match sends your closet list, so it costs a little more. The daily limit keeps strangers from running up your bill.

**Without either option**, everything still works: the built-in rules engine critiques and builds outfits.
