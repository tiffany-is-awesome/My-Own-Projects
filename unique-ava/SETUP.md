# Setting up Unique Ava online

Unique Ava works right away: your closet is saved in the browser and the built-in rules engine styles you.
These one-time steps switch on **accounts** and the **AI stylist**.

## 1. Accounts & cloud sync ✅ done
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

## 2. The AI stylist: Google Gemini (2 minutes, free)
Users never need a key: they just **sign in**, and the `unique-ava-ai` function (already deployed)
calls Gemini for them. You add **one free key, once**, and it also switches on AI in Tiffo and Pantry to Plate.

1. Go to **https://aistudio.google.com** → sign in with Google → **Get API key** → **Create API key**.
   It's free and needs no credit card.
2. Supabase → **Edge Functions → Secrets** → **Add new secret**:
   Name `GEMINI_API_KEY`, Value = the key you just copied → **Save**.
3. Open Unique Ava and sign in. The header badge turns green: **Gemini on**.

Optional secrets: `UNIQUE_AVA_DAILY_LIMIT` (AI calls per user per day, default 60) and
`UNIQUE_AVA_ALLOWED_ORIGIN` = `https://tiffany-is-awesome.github.io` (only your site may call the function).

> **Privacy:** on Google's free tier, what's sent may be used to improve Google's products.
> Unique Ava only sends cut-out clothing photos and outfit details, never the original photo, and says so in the app.
> (To use Claude instead, add `ANTHROPIC_API_KEY` and `AI_PROVIDER` = `claude`, which is paid per use.)

## 3. Photos (optional, any time)
Real photos (for example from Gemini) replace the built-in renders without a rebuild.
See [`unique-ava-photos/README.md`](../unique-ava-photos/README.md) and the prompts in
[`GEMINI-PHOTO-PROMPTS.md`](GEMINI-PHOTO-PROMPTS.md).
