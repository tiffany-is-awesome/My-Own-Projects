// ───────────────────────────────────────────────────────────────────────────
//  UNIQUE AVA CONFIG
//
//  Accounts & cloud sync: Supabase (the same free project Tiffo uses).
//    One-time setup: run supabase/unique-ava.sql in the Supabase SQL Editor.
//    The publishable key below is SAFE to be public: Row Level Security keeps
//    every user's closet private.
//
//  AI: Claude, tried in this order:
//   1. Inside claude.ai (the published preview): the viewer's own Claude account.
//   2. On GitHub Pages: the unique-ava-ai Supabase Edge Function (holds your
//      Anthropic key, signed-in users only). Set AI_PROXY_URL after deploying it
//      (see unique-ava/SETUP.md).
//  If neither is available, the built-in rules engine answers instead.
// ───────────────────────────────────────────────────────────────────────────
export const CONFIG = {
  SUPABASE_URL: 'https://hvhbygkgvxdpvwvclyns.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_t8Zf_XjZPrRZB9piISZOhQ_FXdNja7h',
  // e.g. 'https://hvhbygkgvxdpvwvclyns.supabase.co/functions/v1/unique-ava-ai' once deployed
  AI_PROXY_URL: '',
};
