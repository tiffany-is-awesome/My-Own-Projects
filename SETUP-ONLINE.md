# Turning on Tiffo's online features

Tiffo works right away with **no setup**: accounts and data are saved in each browser.
This guide switches on three extras:

| Feature | What people get | Cost |
|---|---|---|
| ☁️ **Accounts on every device** | Sign in on a phone and a laptop, see the same books | Free (Supabase free plan) |
| ✨ **Real AI** | Google Gemini reads notes, receipts and contracts much better | **Free** (Gemini free plan, no credit card) |
| 📅 **Calendar alarms** | Already built in, no setup needed (see the end) | Free |

Total time: about **15–20 minutes**. You only do this once. **Everything here is free.**

---

## Part 1: Accounts on every device (Supabase, free)

### 1. Create a Supabase project
1. Go to **https://supabase.com** and sign up (signing in with GitHub is easiest).
2. Click **New project**. Name it `tiffo`, make up a strong **database password** (save it somewhere), and pick the region closest to you (e.g. *Southeast Asia (Singapore)*).
3. Wait a minute or two while it sets up.

### 2. Create Tiffo's storage table
1. In the left menu, open **SQL Editor** and click **New query**.
2. Open [`supabase/setup.sql`](supabase/setup.sql) in this repo, copy **everything**, paste it in, and click **Run**.
3. You should see **"Success. No rows returned"**. ✅

> This makes one private row per user. "Row Level Security" means **each person can only ever see their own books**.

### 3. Tell Supabase where Tiffo lives
1. Left menu → **Authentication** → **URL Configuration**.
2. **Site URL:** `https://tiffany-is-awesome.github.io/My-Own-Projects/tiffo.html`
3. Under **Redirect URLs**, click **Add URL** and add the same address. Save.

> This makes the "confirm your email" link bring people back to Tiffo.

### 4. Copy your two connection values
Click the **Connect** button at the top of the project (or **Project Settings → API Keys**) and copy:
- the **Project URL**, which looks like `https://abcdefgh.supabase.co`
- the **Publishable key** (starts with `sb_publishable_…`). If you only see an older **anon** key, that works too.

> These two are **safe to be public**. They're designed to sit in website code.
> ⚠️ Never put the **secret** / **service_role** key in Tiffo.

### 5. Switch Tiffo to online accounts
Either **send the Project URL and Publishable key to Claude** and ask it to switch them on, or do it yourself:

1. Open `tiffo.html` in this repo on GitHub and click the ✏️ **pencil** (Edit).
2. Find the `CONFIG` section near the top and change these lines:
   ```js
   AUTH_PROVIDER: 'supabase',
   SUPABASE_URL: 'https://abcdefgh.supabase.co',
   SUPABASE_ANON_KEY: 'sb_publishable_xxxxxxxx',
   ```
3. Click **Commit changes**. The live site updates in 1–2 minutes.

**Test it:** open Tiffo on your laptop → **Sign in → Sign up** → confirm the email → log something.
Then open Tiffo on your phone and **Sign in** with the same email. Your entries appear. 🎉
The account menu (top right) shows **"☁️ Synced just now"**.

---

## Part 2: Free AI (Google Gemini)

> ⚠️ **Privacy, please read.** On Gemini's **free** plan, Google may use what is sent to improve its products, and **people at Google may read it**.
> That's why Tiffo keeps AI **off** until each person switches it on and agrees (account menu → *✨ Free AI*).
> Suggest that users don't run very private documents through AI.

### 1. Get a free Gemini API key
1. Go to **https://aistudio.google.com** and sign in with a Google account.
2. Click **Get API key** → **Create API key**.
3. Copy the key.

> 💸 **To keep it free:** don't link a billing account or add a card. With no billing, Google simply stops answering for a while when the free limit is reached. Tiffo then uses its built-in rules until the limit resets. **You will never be charged.**
> 🔒 Keep this key secret: don't paste it into Tiffo, GitHub or a chat. It goes **only** into Supabase in step 3.

### 2. Put the AI helper on Supabase
1. In Supabase: left menu → **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Name it exactly: **`tiffo-ai`**
3. Delete the sample code, then copy **everything** from [`supabase/functions/tiffo-ai/index.ts`](supabase/functions/tiffo-ai/index.ts) and paste it in.
4. Click **Deploy**.

### 3. Give the helper your key
1. **Edge Functions → Secrets** (sometimes under *Manage secrets*).
2. Add:
   - `GEMINI_API_KEY` = your Gemini key
   - `TIFFO_ALLOWED_ORIGIN` = `https://tiffany-is-awesome.github.io` *(recommended: only your site can use it)*
3. Save.

### 4. Switch Tiffo to AI
In `tiffo.html`'s `CONFIG`, change:
```js
AI_PROVIDER: 'supabase',
```
Commit (or ask Claude to do it).

**Test it:** sign in on Tiffo → account menu (top right) → **✨ Free AI (Google Gemini): Off** → read the note → **Turn on AI**.
Try a messy note like *"merienda for the team 480"*, or tap **Sample contract**. Under the document title it says **"✨ Read by AI (Gemini)"**.

**Good to know**
- Only **signed-in** users who **switched AI on** use it. Everyone else gets the built-in rules.
- Each person's on/off choice follows their account to all their devices.
- Google renames its models from time to time. The helper tries several free "Flash-Lite" models automatically. To pick one yourself, add a secret `GEMINI_MODEL` (for example `gemini-3.1-flash-lite`).
- If AI never kicks in and the function's **Logs** show *"Invalid JWT"*, open the function's **Details** and turn **off** *"Verify JWT"*. The helper already checks who's signed in by itself.

---

## Part 3: Calendar alarms (already built in)

Tiffo's own alarms ring while Tiffo is open. To get alarms **even when Tiffo is closed**, reminders go into your real calendar:

- **One tap:** after you set a reminder, tap **📅 Add to calendar** in the pop-up message, or tap **📅** / **G** on any reminder.
- **Automatic:** open the **🔔 bell** → at the bottom, choose **Auto-add new reminders to:**
  - **My phone/computer calendar**: downloads a calendar file; your phone asks *"Add to Calendar?"*
  - **Google Calendar**: opens Google Calendar ready to **Save**

> Adding events with *no tap at all* would need Google to review and approve Tiffo as an app. For a small business tool, the one-tap version is the practical choice.

---

## Notes
- **Free plan limits:** Supabase's free plan is plenty for a small app. Free projects can pause after a long time without use; you can resume them from the Supabase dashboard.
- **Changes on two devices at once:** the most recent change wins.
- **Deleting an account** in Tiffo removes that person's cloud data.
