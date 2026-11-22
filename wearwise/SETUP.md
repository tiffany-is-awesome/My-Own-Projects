# Setting up Wearwise online

Wearwise works right away: your closet is saved in the browser and the built-in rules engine styles you.
Accounts are switched on, and the AI stylist needs no setup.

## 1. Accounts & cloud sync ✅ done
Wearwise uses **the same free Supabase project as Tiffo**, so it's already connected.
Sign-ins are shared between the two apps; each app keeps its own private data.

1. Open your Supabase project → **SQL Editor** → **New query**.
2. Paste everything from [`supabase/wearwise.sql`](../supabase/wearwise.sql) and click **Run**.
   You should see "Success. No rows returned". ✅
3. **Authentication → URL Configuration → Redirect URLs** → **Add URL**:
   `https://tiffany-is-awesome.github.io/My-Own-Projects/unique-ava.html`
   (This makes "confirm your email" and "reset password" links come back to Wearwise. The app is served at
   `wearwise.html`; email links deliberately use the old `unique-ava.html` address, which forwards to
   `wearwise.html` with the sign-in token intact, so no new redirect URL is needed.)

**Test it:** open Wearwise (https://tiffany-is-awesome.github.io/My-Own-Projects/wearwise.html) → **Sign in → New here? Create an account** → confirm the email → sign in.
Add a piece, then open the site on your phone and sign in. Your closet appears.
The account menu (top right) shows **☁️ Synced just now**.

> If the menu says **"Cloud not set up"**, step 2 hasn't been run yet.

## 2. The AI stylist: Google Gemini ✅ nothing to set up
There's **no API key anywhere**. Wearwise uses Gemini through **Puter.js** (the "user-pays" model):

- The first time someone uses an AI feature (or clicks **Gemini · Sign in** in the header), Puter shows a
  sign-in pop-up. She signs in or creates a free Puter account, and that's it.
- Her AI use runs on her own Puter allowance (free monthly allowance; she can top up on puter.com if she
  ever needs more). **You pay nothing**, and there's no key to leak.
- Until she signs in, the built-in rules engine keeps styling, so nothing breaks.

*(Optional backup, off by default:* `supabase/functions/unique-ava-ai` *can run Gemini with a server-side
`GEMINI_API_KEY` instead. Only needed if you ever want AI without the Puter sign-in.)*

## 3. Photos (optional, any time)
Real photos (for example from Gemini) replace the built-in renders without a rebuild.
See [`wearwise-photos/README.md`](../wearwise-photos/README.md) and the prompts in
[`GEMINI-PHOTO-PROMPTS.md`](GEMINI-PHOTO-PROMPTS.md).
