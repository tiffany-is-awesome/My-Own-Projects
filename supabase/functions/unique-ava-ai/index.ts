// Unique Ava AI: lets the GitHub Pages site use Claude without exposing your Anthropic API key.
// Deploy as a Supabase Edge Function named "unique-ava-ai" and add the secret ANTHROPIC_API_KEY
// (from https://console.anthropic.com). See unique-ava/SETUP.md.
//
// Only signed-in Unique Ava users may call it (keeps strangers from using up your credit).
// Optional secrets:
//   UNIQUE_AVA_ALLOWED_ORIGIN  e.g. https://tiffany-is-awesome.github.io (only your site may call this)
//   UNIQUE_AVA_DAILY_LIMIT     max Claude calls per user per day (default 60)
//   CLAUDE_MODEL_QUICK / CLAUDE_MODEL_DEFAULT / CLAUDE_MODEL_COMPLEX  override the models below

import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGIN = Deno.env.get("UNIQUE_AVA_ALLOWED_ORIGIN") ?? "*";
const MODELS: Record<string, string> = {
  quick: Deno.env.get("CLAUDE_MODEL_QUICK") ?? "claude-haiku-5-5",
  default: Deno.env.get("CLAUDE_MODEL_DEFAULT") ?? "claude-sonnet-5-5",
  complex: Deno.env.get("CLAUDE_MODEL_COMPLEX") ?? "claude-opus-5-5",
};
const DAILY_LIMIT = Number(Deno.env.get("UNIQUE_AVA_DAILY_LIMIT") ?? 60);
const MAX_IMAGES = 2;
const MAX_IMAGE_B64 = 6_000_000; // ~4.5 MB per image
const ALLOWED_MEDIA = ["image/png", "image/jpeg", "image/webp", "image/gif"];

const cors = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// The public (anon / publishable) key Supabase gives every function.
function publicKey(): string {
  const legacy = Deno.env.get("SUPABASE_ANON_KEY");
  if (legacy) return legacy;
  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}");
    return keys.default ?? (Object.values(keys)[0] as string) ?? "";
  } catch { return ""; }
}

// Simple in-memory per-user daily counter (resets when the function instance restarts).
const usage = new Map<string, { day: string; n: number }>();
function allow(id: string): boolean {
  const day = new Date().toISOString().slice(0, 10);
  const u = usage.get(id);
  if (!u || u.day !== day) { usage.set(id, { day, n: 1 }); return true; }
  if (u.n >= DAILY_LIMIT) return false;
  u.n++; return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return json({ error: "AI is not set up yet (missing ANTHROPIC_API_KEY)." }, 503);

  // 1) Only signed-in users.
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Please sign in to use Claude." }, 401);
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, publicKey());
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return json({ error: "Please sign in to use Claude." }, 401);
  if (!allow(user.id)) return json({ error: "Daily AI limit reached. Try again tomorrow." }, 429);

  // 2) Check the request.
  let body: { prompt?: string; images?: { media_type: string; data: string }[]; tier?: string };
  try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
  const prompt = String(body.prompt ?? "").slice(0, 60_000);
  if (!prompt) return json({ error: "Missing prompt" }, 400);
  const images = (body.images ?? []).slice(0, MAX_IMAGES).filter(
    (i) => ALLOWED_MEDIA.includes(i.media_type) && typeof i.data === "string" && i.data.length < MAX_IMAGE_B64,
  );

  // 3) Ask Claude.
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: MODELS[body.tier ?? "default"] ?? MODELS.default,
      max_tokens: 2000,
      system: "You are the AI stylist inside the Unique Ava wardrobe app. When asked for JSON, reply with only valid JSON.",
      messages: [{
        role: "user",
        content: [
          ...images.map((i) => ({ type: "image", source: { type: "base64", media_type: i.media_type, data: i.data } })),
          { type: "text", text: prompt },
        ],
      }],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("Anthropic error", res.status, JSON.stringify(data).slice(0, 500));
    return json({ error: res.status === 429 ? "Claude is busy. Try again in a moment." : "Claude could not answer." }, res.status === 429 ? 429 : 502);
  }
  const text = (data.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("");
  return json({ text });
});
