// Claude-powered features. Every function returns null when Claude is unavailable,
// so callers fall back to the rules engine.
import { getClaude, noteFailure } from './claude.js';
import { NAMED_COLORS } from './color.js';
import { seasonForTemp, parseContext } from './context.js';
import { short, critique } from './critic.js';

const ARTS = {
  top: ['tee', 'shirt', 'turtleneck', 'knit', 'stripe'],
  bottom: ['trousers', 'jeans', 'shorts', 'skirt'],
  outer: ['coat', 'trench', 'blazer', 'jacket', 'puffer', 'cardigan'],
  shoes: ['sneaker', 'loafer', 'boot', 'sandal'],
  accessory: ['tote', 'crossbody', 'scarf'],
};
const COLOR_NAMES = NAMED_COLORS.map((c) => c.name);
const clampInt = (v, lo, hi, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
const oneOf = (v, list, d) => (list.includes(v) ? v : d);
const arr = (v) => (Array.isArray(v) ? v : []);
const str = (v, max = 400) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Run a Claude call; returns { value } or { error } (never throws). */
async function ask(prompt, opts) {
  const claude = await getClaude();
  if (!claude) return { error: null, offline: true };
  if (opts?.images?.length && !claude.images) opts = { ...opts, images: undefined };
  try { return { value: await claude.json(prompt, opts), provider: claude.name }; }
  catch (e) { return { error: noteFailure(e), code: e?.code }; }
}

const garmentLine = (g) => [
  g.id, g.name, g.category, g.colors.map((c) => c.name).join('/'), g.material, `${g.weight} weight`, `fit ${g.fit}`,
  `warmth ${g.warmth}/5`, `rain ${g.water || 1}/5`, `formality ${g.formality}/5`, `seasons ${g.seasons.join('/')}`,
  g.placeholder ? 'NOT OWNED (basic)' : '',
].filter(Boolean).join(' | ');

// ─────────────────────────────────────────── 1. Vision tagging
export async function tagGarment(cutoutBlob, deviceDraft) {
  const prompt = `You are the cataloguing assistant for a minimalist digital wardrobe app.
The image is ONE clothing item photographed by its owner, with the background removed.
On-device pixel analysis measured its dominant color as "${deviceDraft.colors[0].name}" (${deviceDraft.colors[0].hex}). Trust that unless the image clearly shows a different main color.

Reply with ONLY a JSON object, no other text:
{
  "name": "short retail-style product name, e.g. 'Olive Wide Chino Trousers'",
  "category": one of ${JSON.stringify(Object.keys(ARTS))},
  "art": the closest shape for that category: ${JSON.stringify(ARTS)},
  "color": one of ${JSON.stringify(COLOR_NAMES)},
  "secondColor": a second color from the same list if patterned, else null,
  "pattern": "solid" | "stripe" | "check" | "floral" | "graphic" | "other",
  "material": best guess, e.g. "cotton twill", "merino wool", "suede",
  "weight": "light" | "mid" | "heavy",
  "fit": "fitted" | "regular" | "relaxed" | "oversized",
  "warmth": 0-5, "water": 1-5 (rain resistance), "formality": 1-5 (1 lounge … 5 black tie),
  "seasons": array of "spring","summer","autumn","winter",
  "length": for outerwear "cropped" | "hip" | "long", else null,
  "profile": for shoes "sleek" | "chunky", else null,
  "confidence": 0-1,
  "note": one short sentence about anything you were unsure of, or ""
}
If the image is not a clothing item, set "category" to "top" and "confidence" to 0.`;
  const r = await ask(prompt, { images: [cutoutBlob], tier: 'default' });
  if (!r.value) return { error: r.error, offline: r.offline };
  const v = r.value || {};
  const category = oneOf(v.category, Object.keys(ARTS), deviceDraft.category);
  const colorName = oneOf(v.color, COLOR_NAMES, deviceDraft.colors[0].name);
  const second = COLOR_NAMES.includes(v.secondColor) ? NAMED_COLORS.find((c) => c.name === v.secondColor) : null;
  return {
    provider: r.provider,
    garment: {
      ...deviceDraft,
      name: str(v.name, 80) || deviceDraft.name,
      category,
      art: oneOf(v.art, ARTS[category], ARTS[category][0]),
      colors: [{ name: colorName, hex: deviceDraft.colors[0].hex }, ...(second ? [{ name: second.name, hex: second.hex }] : [])],
      pattern: str(v.pattern, 20) || 'solid',
      material: str(v.material, 60) || deviceDraft.material,
      weight: oneOf(v.weight, ['light', 'mid', 'heavy'], deviceDraft.weight),
      fit: oneOf(v.fit, ['fitted', 'regular', 'relaxed', 'oversized'], 'regular'),
      warmth: clampInt(v.warmth, 0, 5, deviceDraft.warmth),
      water: clampInt(v.water, 1, 5, 1),
      formality: clampInt(v.formality, 1, 5, deviceDraft.formality),
      seasons: arr(v.seasons).filter((s) => ['spring', 'summer', 'autumn', 'winter'].includes(s)).length
        ? arr(v.seasons).filter((s) => ['spring', 'summer', 'autumn', 'winter'].includes(s)) : deviceDraft.seasons,
      ...(category === 'outer' ? { length: oneOf(v.length, ['cropped', 'hip', 'long'], 'hip') } : {}),
      ...(category === 'shoes' ? { profile: oneOf(v.profile, ['sleek', 'chunky'], 'sleek') } : {}),
      confidence: Math.max(0, Math.min(1, Number(v.confidence) || 0.7)),
      aiNote: str(v.note, 200),
      taggedBy: 'claude',
    },
  };
}

// ─────────────────────────────────────────── 2. Stylist critique
export async function critiqueWithClaude(outfit, ctx, rules) {
  const pieces = ['top', 'bottom', 'outer', 'shoes', 'accessory'].filter((k) => outfit[k]).map((k) => `${k.toUpperCase()}: ${garmentLine(outfit[k])}`);
  if (!pieces.length) return null;
  const measured = rules.pillars.map((p) => `${p.label} (rules score ${p.score}): ${[...p.pros.map((x) => '+ ' + x), ...p.cons.map((x) => '- ' + x)].join(' ')}`).join('\n');
  const prompt = `You are an honest, specific personal stylist writing for a minimalist wardrobe app. No flattery; name real trade-offs.

SITUATION: "${ctx.prompt}" → ${ctx.tempC}°C, rain ${ctx.rain >= 0.6 ? 'likely' : 'unlikely'}, occasion: ${ctx.occasionLabel}, season: ${ctx.season}.
OUTFIT:
${pieces.join('\n')}

MEASURED FACTS from the app's rules engine (warmth, water resistance and formality math). Do not contradict these; you may add your own observations:
${measured}

Evaluate the outfit on exactly four pillars: proportions, fabric (fabric & weather practicality), color (color harmony), occasion (occasion fit).
Reply with ONLY this JSON:
{
  "verdict": "one sentence overall take, like a stylist would say it",
  "score": 0-100,
  "pillars": {
    "proportions": { "score": 0-100, "pros": ["…"], "cons": ["…"] },
    "fabric":      { "score": 0-100, "pros": ["…"], "cons": ["…"] },
    "color":       { "score": 0-100, "pros": ["…"], "cons": ["…"] },
    "occasion":    { "score": 0-100, "pros": ["…"], "cons": ["…"] }
  },
  "styling_tip": "one concrete tip that needs no new purchase (a tuck, a roll, a swap within this closet)"
}
Each pros/cons list: 0-3 short sentences that name the actual pieces. Refer to pieces by color and type, never by id.`;
  const r = await ask(prompt, { tier: 'default' });
  if (!r.value) return { error: r.error, offline: r.offline };
  const v = r.value || {};
  const pillars = rules.pillars.map((p) => {
    const c = v.pillars?.[p.id] || {};
    return { ...p, score: clampInt(c.score, 0, 100, p.score), pros: arr(c.pros).map((x) => str(x)).filter(Boolean).slice(0, 3), cons: arr(c.cons).map((x) => str(x)).filter(Boolean).slice(0, 3) };
  });
  return {
    provider: r.provider,
    critique: {
      ...rules,
      overall: clampInt(v.score, 0, 100, rules.overall),
      pillars,
      verdict: str(v.verdict, 300),
      tip: str(v.styling_tip, 300),
      by: 'claude',
    },
  };
}

// ─────────────────────────────────────────── 3. Context + three variations
export async function styleWithClaude(prompt, pool, anchor) {
  const closet = pool.map(garmentLine).join('\n');
  const q = `You are the outfit engine of a personal styling app. The user described where they are going:
"${prompt}"

THEIR CLOSET (one item per line: id | name | category | colors | material | weight | fit | warmth | rain | formality | seasons). Items marked NOT OWNED are placeholder basics: use one only if the closet truly lacks something, and at most one per outfit.
${closet}
${anchor ? `\nANCHOR: every outfit MUST include ${anchor.id} (${anchor.name}).` : ''}

Build exactly 3 distinct outfits using ONLY ids from the list:
1. "Safe & Classic": proven, clean.
2. "Layered & Cozy": texture and a layer (if it's hot, call it "Light & Breezy" instead: airy fabrics, no outer layer).
3. "Smart Casual": one notch sharper than the occasion.
Each outfit needs top, bottom and shoes; outer and accessory are optional (use null). Respect the weather: no suede or canvas in rain, no heavy coats in heat, enough warmth in cold. Avoid re-using the same top or bottom across the three.

Reply with ONLY this JSON:
{
  "context": { "tempC": number, "rain": true/false, "occasion": "short label like 'Coffee meeting'", "formality": 1-5, "city": string or null },
  "outfits": [
    { "name": "Safe & Classic", "blurb": "6-10 word tagline", "top": "id", "bottom": "id", "outer": "id or null", "shoes": "id", "accessory": "id or null", "why": "one sentence on why it works today" }
  ]
}`;
  const r = await ask(q, { tier: 'default' });
  if (!r.value) return { error: r.error, offline: r.offline };
  const v = r.value || {};
  const byId = new Map(pool.map((g) => [g.id, g]));
  const ok = (id, cat) => { const g = byId.get(id); return g && g.category === cat ? g : null; };
  const c = v.context || {};
  const tempC = Number.isFinite(Number(c.tempC)) ? Math.round(Number(c.tempC)) : null;
  const outfits = arr(v.outfits).slice(0, 3).map((o) => ({
    name: str(o.name, 40) || 'Option',
    blurb: str(o.blurb, 90),
    why: str(o.why, 240),
    outfit: { top: ok(o.top, 'top'), bottom: ok(o.bottom, 'bottom'), outer: ok(o.outer, 'outer'), shoes: ok(o.shoes, 'shoes'), accessory: ok(o.accessory, 'accessory') },
  }));
  if (anchor) outfits.forEach((o) => { o.outfit[anchor.category] = anchor; });
  // Repair: if Claude named an unknown id for a required slot, fill it with the best-scoring piece.
  const fallbackCtx = parseContext(prompt);
  for (const o of outfits) for (const slot of ['top', 'bottom', 'shoes']) {
    if (o.outfit[slot]) continue;
    let best = null, bestS = -1;
    for (const g of pool.filter((x) => x.category === slot)) {
      const s = critique({ ...o.outfit, [slot]: g }, fallbackCtx).overall - (g.placeholder ? 3 : 0);
      if (s > bestS) { bestS = s; best = g; }
    }
    o.outfit[slot] = best;
  }
  if (!outfits.length) return { error: 'Claude returned no usable outfits. Showing the rules engine instead.' };
  return {
    provider: r.provider,
    outfits,
    context: tempC === null ? null : {
      tempC, rain: c.rain ? 0.8 : 0.05, occasionLabel: str(c.occasion, 40), formality: clampInt(c.formality, 1, 5, 2),
      city: str(c.city, 40) || null, season: seasonForTemp(tempC),
    },
  };
}

// ─────────────────────────────────────────── 4. Inspiration decomposition (photo)
export async function decomposeWithClaude(imageBlob) {
  const prompt = `This is a fashion inspiration photo the user saved (street style or a lookbook).
List the visible clothing pieces of the main outfit. Reply with ONLY this JSON:
{ "title": "3-5 word name for the look", "items": [ { "label": "e.g. 'black turtleneck'", "category": one of ${JSON.stringify(Object.keys(ARTS))}, "art": closest shape from ${JSON.stringify(ARTS)}, "color": one of ${JSON.stringify(COLOR_NAMES)} } ] }
At most one item per category except accessories (max 2). Do not describe the person.`;
  const r = await ask(prompt, { images: [imageBlob], tier: 'default' });
  if (!r.value) return { error: r.error, offline: r.offline };
  const items = arr(r.value?.items).map((it) => {
    const category = oneOf(it.category, Object.keys(ARTS), null);
    if (!category) return null;
    const color = NAMED_COLORS.find((c) => c.name === it.color) || null;
    return { label: str(it.label, 60) || `${color?.name || ''} ${it.art || category}`.trim(), category, art: oneOf(it.art, ARTS[category], ARTS[category][0]), color: color ? { name: color.name, hex: color.hex } : null };
  }).filter(Boolean);
  if (!items.length) return { error: 'Claude could not find clothing in that image.' };
  return { provider: r.provider, title: str(r.value?.title, 60), items };
}

export { short };
