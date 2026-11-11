// Tiffo AI: a tiny server that lets Tiffo use Claude without exposing your API key.
// Deploy as an Edge Function named "tiffo-ai" and add the secret ANTHROPIC_API_KEY.
// Optional secrets: ANTHROPIC_MODEL (default below), TIFFO_ALLOWED_ORIGIN (e.g. https://tiffany-is-awesome.github.io)

import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGIN = Deno.env.get("TIFFO_ALLOWED_ORIGIN") ?? "*";
const MODEL = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-haiku-5-5"; // fast & low-cost
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
  try { const keys = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}"); return keys.default ?? Object.values(keys)[0] ?? ""; }
  catch { return ""; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  // 1) Only signed-in Tiffo users may use AI (protects your API bill).
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Please sign in to use AI." }, 401);
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, publicKey());
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return json({ error: "Please sign in to use AI." }, 401);

  // 2) Check the request.
  let body: { task?: string; system?: string; prompt?: string; image?: string | null };
  try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
  const { task, system = "", prompt = "", image = null } = body;
  if (task !== "parse_note" && task !== "analyze_document") return json({ error: "Unknown task" }, 400);
  if (prompt.length > 20000 || system.length > 2000) return json({ error: "Too much text" }, 413);

  const content: unknown[] = [];
  if (image) {
    const m = image.match(/^data:(image\/(?:png|jpeg|webp|gif));base64,(.+)$/);
    if (!m) return json({ error: "Unsupported image" }, 400);
    if (m[2].length > 7_000_000) return json({ error: "Image too large" }, 413);
    content.push({ type: "image", source: { type: "base64", media_type: m[1], data: m[2] } });
  }
  content.push({ type: "text", text: prompt });

  // 3) Ask Claude.
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ error: "AI is not set up yet (missing ANTHROPIC_API_KEY)." }, 500);
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: task === "parse_note" ? 300 : 3000,
      system,
      messages: [{ role: "user", content }],
    }),
  });
  if (!r.ok) {
    console.error("Claude API error", r.status, await r.text());
    return json({ error: `AI service error (${r.status})` }, 502);
  }
  const out = await r.json();
  const text = (out.content ?? []).map((c: { text?: string }) => c.text ?? "").join("");
  return json({ text });
});
