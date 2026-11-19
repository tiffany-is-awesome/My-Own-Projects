// Unique Ava AI: the app's stylist brain, using Google Gemini's FREE tier.
// Deployed as the Supabase Edge Function "unique-ava-ai".
//
// App users never need a key: they just sign in to Unique Ava.
// TO TURN ON AI, the site owner adds ONE secret in Supabase (Edge Functions → Secrets):
//   GEMINI_API_KEY      free key from https://aistudio.google.com (no credit card)
// Secrets are shared by every function in the project, so the same key also powers Tiffo and Pantry to Plate.
// Optional: ANTHROPIC_API_KEY + AI_PROVIDER = "claude" to use Claude instead (paid per use).
//
// Optional secrets:
//   GEMINI_MODEL                    force one Gemini model
//   UNIQUE_AVA_ALLOWED_ORIGIN       e.g. https://tiffany-is-awesome.github.io
//   UNIQUE_AVA_DAILY_LIMIT          AI calls per user per day (default 60)
//
// Privacy: on Google's free tier, what is sent may be used to improve Google's products.
// Unique Ava sends only cut-out clothing photos and outfit details, never the original photo.

import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGIN = Deno.env.get("UNIQUE_AVA_ALLOWED_ORIGIN") ?? "*";
const DAILY_LIMIT = Number(Deno.env.get("UNIQUE_AVA_DAILY_LIMIT") ?? 60);
const cors = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

function provider(): "claude" | "gemini" | null {
  const forced = (Deno.env.get("AI_PROVIDER") ?? "").toLowerCase();
  const hasClaude = !!Deno.env.get("ANTHROPIC_API_KEY");
  const hasGemini = !!Deno.env.get("GEMINI_API_KEY");
  if (forced === "claude" && hasClaude) return "claude";
  if (hasGemini) return "gemini";
  if (hasClaude) return "claude";
  return null;
}

function publicKey(): string {
  const legacy = Deno.env.get("SUPABASE_ANON_KEY");
  if (legacy) return legacy;
  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}");
    return keys.default ?? (Object.values(keys)[0] as string) ?? "";
  } catch { return ""; }
}

// Per-user daily counter (resets when the function instance restarts) — protects the free quota.
const usage = new Map<string, { day: string; n: number }>();
function allow(id: string): boolean {
  const day = new Date().toISOString().slice(0, 10);
  const u = usage.get(id);
  if (!u || u.day !== day) { usage.set(id, { day, n: 1 }); return true; }
  if (u.n >= DAILY_LIMIT) return false;
  u.n++; return true;
}

type Img = { mime: string; data: string };
const SYSTEM = "You are the AI stylist inside the Unique Ava wardrobe app. Always answer with valid JSON only: no markdown, no code fences, no extra text.";

async function askGemini(prompt: string, images: Img[], fast: boolean) {
  const models = Deno.env.get("GEMINI_MODEL")
    ? [Deno.env.get("GEMINI_MODEL")!]
    : fast
      ? ["gemini-3.1-flash-lite", "gemini-3.5-flash-lite", "gemini-flash-lite-latest", "gemini-flash-latest"]
      : ["gemini-3.5-flash", "gemini-flash-latest", "gemini-3.1-flash-lite", "gemini-flash-lite-latest"];
  const parts: unknown[] = images.map((i) => ({ inline_data: { mime_type: i.mime, data: i.data } }));
  parts.push({ text: prompt });
  const payload = JSON.stringify({
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: "user", parts }],
    generationConfig: { responseMimeType: "application/json", maxOutputTokens: 4000 },
  });
  let last = 0;
  for (const model of models) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": Deno.env.get("GEMINI_API_KEY")! }, body: payload,
    });
    last = r.status;
    if (r.ok) {
      const out = await r.json();
      const text = (out.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
      if (text) return { text, model };
      continue;
    }
    const detail = await r.text();
    console.error(`Gemini ${model} → ${r.status}`, detail.slice(0, 300));
    if (r.status === 429) return { status: 429, error: "The free AI limit was reached for now. Try again later." };
    if (r.status === 400 && /API key/i.test(detail)) return { status: 500, error: "The Gemini API key looks wrong." };
    // 404 / unsupported model: try the next one
  }
  return { status: 502, error: `AI service unavailable (${last})` };
}

async function askClaude(prompt: string, images: Img[], fast: boolean) {
  const model = fast ? "claude-haiku-5-5" : "claude-sonnet-5-5";
  const content: unknown[] = images.map((i) => ({ type: "image", source: { type: "base64", media_type: i.mime, data: i.data } }));
  content.push({ type: "text", text: prompt });
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: 4000, system: SYSTEM, messages: [{ role: "user", content }] }),
  });
  if (!r.ok) {
    console.error(`Claude ${model} → ${r.status}`, (await r.text()).slice(0, 300));
    return r.status === 429 ? { status: 429, error: "The AI is busy. Try again in a moment." } : { status: 502, error: `AI service unavailable (${r.status})` };
  }
  const out = await r.json();
  return { text: (out.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join(""), model };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  let body: { task?: string; prompt?: string; images?: { media_type: string; data: string }[]; tier?: string };
  try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }

  // Status check (no sign-in needed): tells the app whether AI is switched on.
  const p = provider();
  if (body.task === "status") return json({ ready: !!p, provider: p === "claude" ? "Claude" : p === "gemini" ? "Gemini" : null });
  if (!p) return json({ error: "AI isn't switched on yet. Add GEMINI_API_KEY in Supabase." }, 503);

  // Only signed-in users may use AI, so strangers can't use up the free quota.
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, publicKey());
  const { data: { user }, error: authError } = token ? await supabase.auth.getUser(token) : { data: { user: null }, error: true };
  if (authError || !user) return json({ error: "Please sign in to use the AI stylist." }, 401);
  if (!allow(user.id)) return json({ error: "Daily AI limit reached. Try again tomorrow." }, 429);

  const prompt = String(body.prompt ?? "");
  if (!prompt || prompt.length > 60000) return json({ error: "Bad prompt" }, 400);
  const images: Img[] = [];
  for (const i of (body.images ?? []).slice(0, 2)) {
    if (!/^image\/(png|jpeg|webp|gif)$/.test(i?.media_type ?? "") || typeof i.data !== "string") return json({ error: "Unsupported image" }, 400);
    if (i.data.length > 7_000_000) return json({ error: "Image too large" }, 413);
    images.push({ mime: i.media_type, data: i.data });
  }

  const fast = body.tier === "quick";
  const out = p === "claude" ? await askClaude(prompt, images, fast) : await askGemini(prompt, images, fast);
  if ("error" in out) return json({ error: out.error }, out.status);
  return json({ text: out.text, provider: p === "claude" ? "Claude" : "Gemini", model: out.model });
});
