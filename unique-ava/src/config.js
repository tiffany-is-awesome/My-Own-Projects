// ───────────────────────────────────────────────────────────────────────────
//  UNIQUE AVA CONFIG
//
//  Accounts & cloud sync: Supabase (the same free project Tiffo uses).
//    One-time setup: run supabase/unique-ava.sql in the Supabase SQL Editor.
//    The publishable key below is SAFE to be public: Row Level Security keeps
//    every user's closet private.
//
//  AI: Google Gemini (free tier) through the unique-ava-ai Supabase Edge Function.
//    Users never need a key: they just sign in. The site owner adds ONE free
//    GEMINI_API_KEY secret in Supabase (shared with Tiffo and Pantry to Plate).
//    Inside the claude.ai preview (which can't reach Supabase), Claude stands in.
//  If no AI is available, the built-in rules engine answers instead.
// ───────────────────────────────────────────────────────────────────────────
export const CONFIG = {
  SUPABASE_URL: 'https://hvhbygkgvxdpvwvclyns.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_t8Zf_XjZPrRZB9piISZOhQ_FXdNja7h',
  // The unique-ava-ai function (Gemini free tier). Users just sign in; no key needed on their side.
  AI_PROXY_URL: 'https://hvhbygkgvxdpvwvclyns.supabase.co/functions/v1/unique-ava-ai',
};
