// ───────────────────────────────────────────────────────────────────────────
//  WEARWISE CONFIG
//
//  Accounts & cloud sync: Supabase (the same free project Tiffo uses).
//    One-time setup: run supabase/unique-ava.sql in the Supabase SQL Editor.
//    The publishable key below is SAFE to be public: Row Level Security keeps
//    every user's closet private.
//
//  AI: Google Gemini through Puter.js. NO API KEY anywhere: the first time a user
//    asks the AI stylist something, Puter shows a sign-in pop-up (free account).
//    Her usage runs on her own Puter allowance, so the site owner pays nothing.
//    Inside the claude.ai preview (which blocks outside scripts), Claude stands in.
//  If the AI isn't available, the built-in rules engine answers instead.
// ───────────────────────────────────────────────────────────────────────────
export const CONFIG = {
  SUPABASE_URL: 'https://hvhbygkgvxdpvwvclyns.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_t8Zf_XjZPrRZB9piISZOhQ_FXdNja7h',
  // Optional backup only (needs a key on the server). Leave empty: the AI runs on Gemini via Puter, no key.
  AI_PROXY_URL: '',

  // 🍩 "Treat the developer" tip jar (same as Tiffo). Hidden until at least one of these is filled in.
  GCASH_QR: '',    // your GCash / QR Ph image: a file next to wearwise.html (e.g. 'gcash-qr.png') or an image URL.
                   // In GCash: Profile → QR → "Receive" → save image.
  GCASH_NAME: '',  // optional name shown under the title, e.g. 'J. Dela Cruz'
  TIP_URL: '',     // optional card / PayPal / Ko-fi page, e.g. 'https://ko-fi.com/yourname'
};
