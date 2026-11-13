// Ava's Choices AI: lets the GitHub Pages site use Claude without exposing your Anthropic API key.
// Deploy as a Supabase Edge Function named "avas-ai" and add the secret ANTHROPIC_API_KEY
// (from https://console.anthropic.com). See avas-choices/SETUP-CLAUDE.md.
//
// Optional secrets:
//   AVAS_ALLOWED_ORIGIN  e.g. https://tiffany-is-awesome.github.io (only your site may call this)
//   CLAUDE_MODEL_QUICK / CLAUDE_MODEL_DEFAULT / CLAUDE_MODEL_COMPLEX  override the models below
//   AVAS_DAILY_LIMIT     max calls per visitor IP per day (default 60) to protect your bill

const ALLOWED_ORIGIN = Deno.env.get("AVAS_ALLOWED_ORIGIN") ?? "*";
const MODELS: Record<string, string> = {
  quick: Deno.env.get("CLAUDE_MODEL_QUICK") ?? "claude-haiku-5-5",
  default: Deno.env.get("CLAUDE_MODEL_DEFAULT") ?? "claude-sonnet-5-5",
  complex: Deno.env.get("CLAUDE_MODEL_COMPLEX") ?? "claude-opus-5-5",
};
const DAILY_LIMIT = Number(Deno.env.get("AVAS_DAILY_LIMIT") ?? 60);
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

// Simple in-memory per-IP daily counter (resets when the function instance restarts).
const usage = new Map<string, { day: string; n: number }>();
function allow(ip: string): boolean {
  const day = new Date().toISOString().slice(0, 10);
  const u = usage.get(ip);
  if (!u || u.day !== day) { usage.set(ip, { day, n: 1 }); return true; }
  if (u.n >= DAILY_LIMIT) return false;
  u.n++; return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return json({ error: "AI is not set up yet (missing ANTHROPIC_API_KEY)." }, 503);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (!allow(ip)) return json({ error: "Daily AI limit reached. Try again tomorrow." }, 429);

  let body: { prompt?: string; images?: { media_type: string; data: string }[]; tier?: string };
  try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
  const prompt = String(body.prompt ?? "").slice(0, 60_000);
  if (!prompt) return json({ error: "Missing prompt" }, 400);

  const images = (body.images ?? []).slice(0, MAX_IMAGES).filter(
    (i) => ALLOWED_MEDIA.includes(i.media_type) && typeof i.data === "string" && i.data.length < MAX_IMAGE_B64,
  );
  const content = [
    ...images.map((i) => ({ type: "image", source: { type: "base64", media_type: i.media_type, data: i.data } })),
    { type: "text", text: prompt },
  ];

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: MODELS[body.tier ?? "default"] ?? MODELS.default,
      max_tokens: 2000,
      system: "You are the AI stylist inside the Ava's Choices wardrobe app. When asked for JSON, reply with only valid JSON.",
      messages: [{ role: "user", content }],
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
