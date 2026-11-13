// ───────────────────────────────────────────────────────────────────────────
//  AVA’S CHOICES CONFIG
//
//  Ava’s Choices uses Claude in one of two ways, tried in this order:
//   1. Inside claude.ai (the published preview): Claude is called directly on the
//      viewer's own Claude account. Nothing to set up.
//   2. On GitHub Pages: through a tiny Supabase Edge Function that keeps your
//      Anthropic API key secret. Deploy supabase/functions/avas-ai and paste
//      its URL below (see avas-choices/SETUP-CLAUDE.md).
//  If neither is available, the built-in rules engine answers instead.
// ───────────────────────────────────────────────────────────────────────────
export const CONFIG = {
  // e.g. 'https://abcdefgh.supabase.co/functions/v1/avas-ai'
  AI_PROXY_URL: '',
  // The project's publishable/anon key (safe to be public). Needed by Supabase to reach the function.
  SUPABASE_ANON_KEY: '',
};
