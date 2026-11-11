// Tiffo AI: a tiny server that lets Tiffo use Google Gemini's FREE tier without exposing your key.
// Deploy as a Supabase Edge Function named "tiffo-ai" and add the secret GEMINI_API_KEY
// (free key from https://aistudio.google.com, no credit card needed).
//
// Optional secrets:
//   GEMINI_MODEL          force one model (otherwise the free-friendly list below is tried in order)
//   TIFFO_ALLOWED_ORIGIN  e.g. https://tiffany-is-awesome.github.io (only your site may call this)
//
// Privacy: on Google's free tier, what is sent may be used to improve Google's products and
// may be read by human reviewers. Tiffo asks each user to agree before AI is used for them.

import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGIN = Deno.env.get("TIFFO_ALLOWED_ORIGIN") ?? "*";
const MODELS = Deno.env.get("GEMINI_MODEL")
  ? [Deno.env.get("GEMINI_MODEL")!]
  : ["gemini-3.1-flash-lite", "gemini-3.5-flash-lite", "gemini-flash-lite-latest", "gemini-flash-latest"];

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  // 1) Only signed-in Tiffo users may use AI (keeps strangers from using up your free quota).
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

  const parts: unknown[] = [];
  if (image) {
    const m = image.match(/^data:(image\/(?:png|jpeg|webp|gif));base64,(.+)$/);
    if (!m) return json({ error: "Unsupported image" }, 400);
    if (m[2].length > 7_000_000) return json({ error: "Image too large" }, 413);
    parts.push({ inline_data: { mime_type: m[1], data: m[2] } });
  }
  parts.push({ text: prompt });

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return json({ error: "AI is not set up yet (missing GEMINI_API_KEY)." }, 500);

  // 3) Ask Gemini. Try each model until one answers (model names change over time).
  const payload = JSON.stringify({
    systemInstruction: system ? { parts: [{ text: system }] } : undefined,
    contents: [{ role: "user", parts }],
    generationConfig: { responseMimeType: "application/json", maxOutputTokens: task === "parse_note" ? 400 : 4000 },
  });
  let lastStatus = 0;
  for (const model of MODELS) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: payload,
    });
    lastStatus = r.status;
    if (r.ok) {
      const out = await r.json();
      const text = (out.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
      if (text) return json({ text, model });
      continue;
    }
    const detail = await r.text();
    console.error(`Gemini ${model} → ${r.status}`, detail.slice(0, 300));
    if (r.status === 429) return json({ error: "The free AI limit was reached for now. Tiffo will use its built-in rules until it resets." }, 429);
    if (r.status === 400 && /API key/i.test(detail)) return json({ error: "The Gemini API key looks wrong." }, 500);
    // 404 / 403 / other: model unavailable on this key, so try the next one.
  }
  return json({ error: `AI service unavailable (${lastStatus})` }, 502);
});
