# Pantry to Plate

Snap your fridge, get recipes from every cuisine made **only** from what's in your kitchen.

Live site: https://tiffany-is-awesome.github.io/My-Own-Projects/pantry-to-plate/

## Turning on accounts (Supabase, about 5 minutes, free)

Pantry to Plate uses the **same Supabase project as Tiffo**, with its own private table.

1. **Create the table.** In Supabase, open **SQL Editor → New query**, paste everything from
   [`supabase/pantry-setup.sql`](../supabase/pantry-setup.sql) and click **Run**.
   You should see "Success. No rows returned".
2. **Allow the sign-in links to come back here.** Go to **Authentication → URL Configuration → Redirect URLs → Add URL** and add:
   `https://tiffany-is-awesome.github.io/My-Own-Projects/pantry-to-plate/`
   Don't change the **Site URL**; that one stays pointed at Tiffo.
3. That's it. Open the live site, click **Sign in → Create an account**, confirm the email, and sign in.
   Your pantry, staples and cookbooks now follow you to every device.

The connection settings live in the `CONFIG` block near the top of the script in `index.html`.
The key there is the **publishable** key, which is safe to be public. Never put the secret / service_role key in this file.

> Sign-in only works on the published site. The claude.ai preview blocks connections to other servers, so the Sign in button is hidden there.

## The AI

Every AI request goes through the `AI PROVIDER` block in `index.html`. Right now it uses Claude, which works in the claude.ai version.
On the published site the app runs in demo mode (sample recipes) until you plug your own AI into that block.
