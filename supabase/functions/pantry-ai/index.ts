// Pantry to Plate AI: a tiny server that lets the app use an AI without exposing your key.
// Deployed as the Supabase Edge Function "pantry-ai".
//
// TO TURN ON AI, add ONE secret in Supabase (Edge Functions → Secrets):
//   ANTHROPIC_API_KEY   use Claude   (key from https://console.anthropic.com, paid per use)
//   GEMINI_API_KEY      use Gemini   (free key from https://aistudio.google.com)
// If both are set, Claude is used unless you add AI_PROVIDER = "gemini".
//
// Optional secrets:
//   ANTHROPIC_MODEL / ANTHROPIC_FAST_MODEL   override the Claude models
//   GEMINI_MODEL                              force one Gemini model
//   PANTRY_ALLOWED_ORIGIN                     e.g. https://tiffany-is-awesome.github.io

import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGIN = Deno.env.get("PANTRY_ALLOWED_ORIGIN") ?? "*";
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
  if (forced === "gemini" && hasGemini) return "gemini";
  if (forced === "claude" && hasClaude) return "claude";
  if (hasClaude) return "claude";
  if (hasGemini) return "gemini";
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

type Img = { mime: string; data: string };
const SYSTEM = "You are the AI inside a cooking app. Always answer with valid JSON only: no markdown, no code fences, no extra text.";

async function askClaude(prompt: string, images: Img[], fast: boolean) {
  const model = fast
    ? (Deno.env.get("ANTHROPIC_FAST_MODEL") ?? "claude-haiku-5-5")
    : (Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-5-5");
  const content: unknown[] = images.map((i) => ({ type: "image", source: { type: "base64", media_type: i.mime, data: i.data } }));
  content.push({ type: "text", text: prompt });
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: fast ? 1500 : 12000, system: SYSTEM, messages: [{ role: "user", content }] }),
  });
  if (!r.ok) {
    const detail = await r.text();
    console.error(`Claude ${model} → ${r.status}`, detail.slice(0, 300));
    if (r.status === 429) return { status: 429, error: "The AI is busy. Wait a minute and try again." };
    if (r.status === 401) return { status: 500, error: "The Claude API key looks wrong." };
    return { status: 502, error: `AI service unavailable (${r.status})` };
  }
  const out = await r.json();
  const text = (out.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("");
  return { text, model };
}

async function askGemini(prompt: string, images: Img[], fast: boolean) {
  const models = Deno.env.get("GEMINI_MODEL")
    ? [Deno.env.get("GEMINI_MODEL")!]
    : ["gemini-3.1-flash-lite", "gemini-3.5-flash-lite", "gemini-flash-lite-latest", "gemini-flash-latest"];
  const parts: unknown[] = images.map((i) => ({ inline_data: { mime_type: i.mime, data: i.data } }));
  parts.push({ text: prompt });
  const payload = JSON.stringify({
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: "user", parts }],
    generationConfig: { responseMimeType: "application/json", maxOutputTokens: fast ? 1500 : 12000 },
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
  }
  return { status: 502, error: `AI service unavailable (${last})` };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  let body: { task?: string; prompt?: string; images?: string[]; fast?: boolean };
  try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }

  // Status check (no sign-in needed): tells the app whether an AI key has been added.
  const p = provider();
  if (body.task === "status") return json({ ready: !!p, provider: p === "claude" ? "Claude" : p === "gemini" ? "Gemini" : null });
  if (!p) return json({ error: "AI isn't set up yet. Add ANTHROPIC_API_KEY or GEMINI_API_KEY in Supabase." }, 503);

  // Only signed-in users may use AI, so strangers can't run up your bill or quota.
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, publicKey());
  const { data: { user }, error: authError } = token ? await supabase.auth.getUser(token) : { data: { user: null }, error: true };
  if (authError || !user) return json({ error: "Please sign in to use AI." }, 401);

  const prompt = String(body.prompt ?? "");
  if (!prompt || prompt.length > 30000) return json({ error: "Bad prompt" }, 400);
  const images: Img[] = [];
  for (const url of (body.images ?? []).slice(0, 2)) {
    const m = String(url).match(/^data:(image\/(?:png|jpeg|webp|gif));base64,(.+)$/);
    if (!m) return json({ error: "Unsupported image" }, 400);
    if (m[2].length > 7_000_000) return json({ error: "Image too large" }, 413);
    images.push({ mime: m[1], data: m[2] });
  }

  const out = p === "claude" ? await askClaude(prompt, images, !!body.fast) : await askGemini(prompt, images, !!body.fast);
  if ("error" in out) return json({ error: out.error }, out.status);
  return json({ text: out.text, provider: p === "claude" ? "Claude" : "Gemini", model: out.model });
});
