// AI stylist features (Gemini via Puter on the live site). Every function returns
// { error } / { offline } instead of throwing, so callers fall back to the rules engine.
// Whatever the AI suggests is VALIDATED by the rules engine before it is shown.
import { getClaude, noteFailure } from './claude.js';
import { NAMED_COLORS } from './color.js';
import { short, critique, isComplete, isDress } from './critic.js';
import { generateOutfits, explain, describe, isAvailable, GOOD } from './generator.js';
import { ARTS, STYLES, SLEEVES, OCCASIONS, slotOf } from '../data/closet.js';

const CATS = Object.keys(ARTS);
const STYLE_IDS = STYLES.map((s) => s.id);
const OCC_IDS = OCCASIONS.map((o) => o.id);
const COLOR_NAMES = NAMED_COLORS.map((c) => c.name);
const clampInt = (v, lo, hi, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
const oneOf = (v, list, d) => (list.includes(v) ? v : d);
const arr = (v) => (Array.isArray(v) ? v : []);
const str = (v, max = 400) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Run an AI call; returns { value, provider } or { error } / { offline } (never throws). */
async function ask(prompt, opts) {
  const ai = await getClaude();
  if (!ai) return { error: null, offline: true };
  if (opts?.images?.length && !ai.images) opts = { ...opts, images: undefined };
  try { return { value: await ai.json(prompt, opts), provider: ai.name }; }
  catch (e) { return { error: noteFailure(e), code: e?.code }; }
}

const garmentLine = (g) => [
  g.id, g.name, slotOf(g) === 'top' && isDress(g) ? 'dress' : slotOf(g), g.colors.map((c) => c.name).join('/'),
  g.pattern && g.pattern !== 'solid' ? g.pattern : '', g.material, g.style ? `style ${g.style}` : '', `fit ${g.fit}`,
  `warmth ${g.warmth}/5`, `rain ${g.water || 1}/5`, `formality ${g.formality}/5`, `seasons ${(g.seasons || []).join('/')}`,
].filter(Boolean).join(' | ');

// ─────────────────────────────────────────── 1. Vision tagging
export async function tagGarment(cutoutBlob, deviceDraft) {
  const prompt = `You are the cataloguing assistant for a digital wardrobe app.
The image is ONE clothing item photographed by its owner, with the background removed.
On-device pixel analysis measured its dominant color as "${deviceDraft.colors[0].name}" (${deviceDraft.colors[0].hex}). Trust that unless the image clearly shows a different main color.

Reply with ONLY a JSON object, no other text:
{
  "name": "short retail-style product name, e.g. 'Olive Wide Chino Trousers'",
  "category": one of ${JSON.stringify(CATS)}  (bags, scarves, hats, jewelry and belts are "accessory"),
  "art": the closest shape for that category: ${JSON.stringify(ARTS)},
  "color": main color, one of ${JSON.stringify(COLOR_NAMES)},
  "secondColor": a second color from the same list if patterned or two-tone, else null,
  "pattern": "solid" | "stripe" | "check" | "floral" | "dots" | "graphic" | "other",
  "material": best guess, e.g. "cotton twill", "merino wool", "suede",
  "style": one of ${JSON.stringify(STYLE_IDS)},
  "sleeve": one of ${JSON.stringify(SLEEVES)} for tops/dresses/outerwear, else null,
  "weight": "light" | "mid" | "heavy",
  "fit": "fitted" | "regular" | "relaxed" | "oversized",
  "warmth": 0-5, "water": 1-5 (rain resistance), "formality": 1-5 (1 lounge … 5 black tie),
  "seasons": array of "spring","summer","autumn","winter",
  "occasions": array from ${JSON.stringify(OCC_IDS)} where it would be appropriate,
  "length": for outerwear "cropped" | "hip" | "long", else null,
  "profile": for shoes "sleek" | "chunky", else null,
  "confidence": 0-1,
  "note": one short sentence about anything you were unsure of, or ""
}
If the image is not a clothing item, set "confidence" to 0.`;
  const r = await ask(prompt, { images: [cutoutBlob], tier: 'default' });
  if (!r.value) return { error: r.error, offline: r.offline };
  return { provider: r.provider, garment: applyTags(deviceDraft, r.value) };
}

/** Validate the AI's tags and merge them into the on-device draft (never trust blindly). */
export function applyTags(draft, v = {}) {
  const category = oneOf(v.category, CATS, draft.category);
  const colorName = oneOf(v.color, COLOR_NAMES, draft.colors[0].name);
  const second = COLOR_NAMES.includes(v.secondColor) ? NAMED_COLORS.find((c) => c.name === v.secondColor) : null;
  const seasons = arr(v.seasons).filter((s) => ['spring', 'summer', 'autumn', 'winter'].includes(s));
  return {
    ...draft,
    name: str(v.name, 80) || draft.name,
    category,
    art: oneOf(v.art, ARTS[category], ARTS[category][0]),
    colors: [{ name: colorName, hex: draft.colors[0].hex }, ...(second && second.name !== colorName ? [{ name: second.name, hex: second.hex }] : [])],
    pattern: oneOf(v.pattern, ['solid', 'stripe', 'check', 'floral', 'dots', 'graphic', 'other'], 'solid'),
    material: str(v.material, 60) || draft.material,
    style: oneOf(v.style, STYLE_IDS, draft.style || 'casual'),
    sleeve: oneOf(v.sleeve, SLEEVES, null),
    weight: oneOf(v.weight, ['light', 'mid', 'heavy'], draft.weight),
    fit: oneOf(v.fit, ['fitted', 'regular', 'relaxed', 'oversized'], 'regular'),
    warmth: clampInt(v.warmth, 0, 5, draft.warmth),
    water: clampInt(v.water, 1, 5, 1),
    formality: clampInt(v.formality, 1, 5, draft.formality),
    seasons: seasons.length ? seasons : draft.seasons,
    occasions: arr(v.occasions).filter((o) => OCC_IDS.includes(o)),
    ...(category === 'outer' ? { length: oneOf(v.length, ['cropped', 'hip', 'long'], 'hip') } : {}),
    ...(category === 'shoes' ? { profile: oneOf(v.profile, ['sleek', 'chunky'], 'sleek') } : {}),
    confidence: Math.max(0, Math.min(1, Number(v.confidence) || 0.5)),
    aiNote: str(v.note, 200),
    taggedBy: 'ai',
    tagSource: 'ai',
    // An AI reading of a photo is still a suggestion. Fabric is hard to judge from a picture, so it always stays
    // "not checked" until she confirms it; with low confidence every detail does.
    unverified: (Number(v.confidence) || 0) >= 0.75 ? ['material'] : ['category', 'art', 'pattern', 'material', 'fit', 'warmth', 'formality', 'water', 'style'],
  };
}

// ─────────────────────────────────────────── 2. Stylist critique
export async function critiqueWithClaude(outfit, ctx, rules) {
  const pieces = ['top', 'bottom', 'outer', 'shoes', 'bag', 'accessory'].filter((k) => outfit[k]).map((k) => `${k.toUpperCase()}: ${garmentLine(outfit[k])}`);
  if (!pieces.length) return null;
  const measured = rules.pillars.map((p) => `${p.label} (rules score ${p.score}): ${[...p.pros.map((x) => '+ ' + x), ...p.cons.map((x) => '- ' + x)].join(' ')}`).join('\n');
  const ids = rules.pillars.map((p) => p.id);
  const prompt = `You are an honest, specific personal stylist. Write for someone with no fashion vocabulary: plain words, no jargon. No flattery; name real trade-offs.

SITUATION: "${ctx.prompt}" → ${ctx.tempC}°C, rain ${ctx.rain >= 0.6 ? 'likely' : 'unlikely'}, occasion: ${ctx.occasionLabel}${ctx.style ? `, wanted style: ${ctx.style}` : ''}${ctx.prefs?.length ? `, preferences: ${ctx.prefs.join(', ')}` : ''}.
OUTFIT:
${pieces.join('\n')}

MEASURED FACTS from the app's rules engine (warmth, water resistance, formality, color and pattern math). Do not contradict these; you may add your own observations:
${measured}

Evaluate on exactly these pillars: ${ids.join(', ')}.
Reply with ONLY this JSON:
{
  "verdict": "one sentence overall take, like a friendly stylist would say it",
  "score": 0-100,
  "pillars": { ${ids.map((id) => `"${id}": { "score": 0-100, "pros": ["…"], "cons": ["…"] }`).join(', ')} },
  "styling_tip": "one concrete tip that needs no new purchase (a tuck, a roll, a swap within this closet)"
}
Each pros/cons list: 0-3 short sentences that name the actual pieces by color and type, never by id.`;
  const r = await ask(prompt, { tier: 'default' });
  if (!r.value) return { error: r.error, offline: r.offline };
  const v = r.value || {};
  const pillars = rules.pillars.map((p) => {
    const c = v.pillars?.[p.id] || {};
    return { ...p, score: clampInt(c.score, 0, 100, p.score), pros: arr(c.pros).map((x) => str(x)).filter(Boolean).slice(0, 3), cons: arr(c.cons).map((x) => str(x)).filter(Boolean).slice(0, 3) };
  });
  return {
    provider: r.provider,
    critique: { ...rules, overall: clampInt(v.score, 0, 100, rules.overall), pillars, verdict: str(v.verdict, 300), tip: str(v.styling_tip, 300), by: 'claude', provider: r.provider },
  };
}

const likedLine = (ctx, avail) => {
  const p = ctx.personal;
  if (!p) return '';
  const liked = avail.filter((g) => (p.items?.[g.id] || 0) >= 1).map((g) => g.id);
  const disliked = avail.filter((g) => (p.items?.[g.id] || 0) <= -1).map((g) => g.id);
  return [liked.length ? `She has rated outfits with these pieces highly: ${liked.join(', ')}.` : '', disliked.length ? `She rated outfits with these poorly, so use them only if they clearly work: ${disliked.join(', ')}.` : ''].filter(Boolean).join(' ') + (liked.length || disliked.length ? '\n' : '');
};

// ─────────────────────────────────────────── 3. Three outfits (AI picks, rules engine validates)
/**
 * @returns {{ outfits: [{ name, outfit, critique, why, source: 'ai'|'rules', note? }], provider, error?, missing? }}
 * Always returns the best available answer: AI picks that pass validation, topped up from the rules engine.
 */
export async function styleWithAI({ ctx, pool, anchor = null, direction = null }) {
  const avail = pool.filter(isAvailable);
  const rules = generateOutfits(avail, ctx, anchor);
  if (rules.missing?.length || rules.unavailable) return { ...rules, outfits: [] };

  const closet = avail.map(garmentLine).join('\n');
  const q = `You are the outfit stylist of a wardrobe app. Build outfits ONLY from the closet below (the person's own, available clothes).

THE SITUATION: occasion ${ctx.occasionLabel} · ${ctx.tempC}°C${ctx.rain >= 0.6 ? ', rain likely' : ''}${ctx.style ? ` · style: ${ctx.style}` : ''}${ctx.prefs?.length ? ` · preferences: ${ctx.prefs.join(', ')}` : ''}${ctx.prompt ? ` · note: "${ctx.prompt}"` : ''}.
${likedLine(ctx, avail)}${anchor ? `MUST INCLUDE in every outfit: ${anchor.id} (${anchor.name}).` : ''}${direction ? `\nSTYLING DIRECTION: ${direction}.` : ''}

CLOSET (id | name | slot | colors | pattern | material | style | fit | warmth | rain | formality | seasons):
${closet}

Build exactly 3 distinct outfits that a stylish person would genuinely want to wear. Each needs: (top + bottom) OR a dress (slot "top", then bottom is null), plus shoes. Outerwear, bag and one accessory are optional (null if not needed).
Check the whole outfit: color harmony, pattern mix, proportions, formality, occasion, weather practicality (no suede/canvas/sandals in rain, nothing heavy in heat, enough warmth in cold), shoes that suit the outfit, accessories that help rather than clutter, and comfort. Don't reuse the same top or bottom across the 3 outfits if the closet allows.

Reply with ONLY this JSON:
{ "outfits": [ { "top": "id", "bottom": "id or null", "outer": "id or null", "shoes": "id", "bag": "id or null", "accessory": "id or null", "why": "1-2 plain sentences: why this works for the situation" } ] }`;
  const r = await ask(q, { tier: 'default' });
  if (!r.value) {
    return { outfits: rules.outfits.map((x) => ({ ...x, source: 'rules' })), note: rules.note, error: r.offline ? null : r.error, offline: r.offline };
  }
  const byId = new Map(avail.map((g) => [g.id, g]));
  const pick = (id, slot) => { const g = byId.get(id); return g && slotOf(g) === slot ? g : null; };
  const seen = new Set();
  const validated = [];
  let rejected = 0;
  for (const raw of arr(r.value?.outfits).slice(0, 3)) {
    const o = { top: pick(raw.top, 'top'), bottom: pick(raw.bottom, 'bottom'), outer: pick(raw.outer, 'outer'), shoes: pick(raw.shoes, 'shoes'), bag: pick(raw.bag, 'bag'), accessory: pick(raw.accessory, 'accessory') };
    if (isDress(o.top)) o.bottom = null;
    if (anchor) o[slotOf(anchor)] = anchor;
    const k = Object.values(o).map((x) => x?.id || '-').join('|');
    const c = isComplete(o) ? critique(o, ctx) : null;
    const weather = c?.pillars.find((p) => p.id === 'fabric').score ?? 0;
    // Independent validation: complete, uses her real available items, practical, and genuinely decent.
    if (!c || seen.has(k) || weather < 60 || c.overall < GOOD || c.dealBreakers.length) { rejected++; continue; }
    seen.add(k);
    validated.push({ name: describe(o), outfit: o, critique: c, why: str(raw.why, 300) || explain(o, c, ctx), source: 'ai' });
  }
  // Nothing the AI suggested passed: show exactly what the rules engine shows on its own (same bar, same note).
  if (!validated.length) return { outfits: rules.outfits.map((x) => ({ ...x, source: 'rules' })), provider: r.provider, note: [rejected ? `The rules engine replaced the AI's suggestions: they didn't pass its checks (incomplete, impractical for the weather, or a weak match).` : '', rules.note].filter(Boolean).join(' ') };
  // Top up from the rules engine, but only with outfits that pass the same bar as the AI's (≥ GOOD, no deal-breaker).
  // (When the rules engine has no good outfit, it returns one "closest option" below the bar: that is not added here.)
  for (const x of rules.outfits) {
    if (validated.length >= 3) break;
    if (x.weak || x.critique.overall < GOOD || x.critique.dealBreakers.length) continue;
    const k = Object.values(x.outfit).map((g) => g?.id || '-').join('|');
    if (seen.has(k)) continue;
    seen.add(k);
    validated.push({ ...x, source: 'rules' });
  }
  return {
    outfits: validated,
    provider: r.provider,
    note: [rejected ? `The rules engine replaced ${rejected} AI suggestion${rejected > 1 ? 's' : ''} that didn't pass its checks (incomplete, impractical for the weather, or a weak match).` : '',
      validated.length < 3 ? `Only ${validated.length} good outfit${validated.length > 1 ? 's' : ''} for this, so that's all you're shown.` : ''].filter(Boolean).join(' '),
  };
}

// ─────────────────────────────────────────── 4. Inspiration decomposition (photo)
export async function decomposeWithClaude(imageBlob) {
  const prompt = `This is a fashion inspiration photo the user saved (street style or a lookbook).
List the visible clothing pieces of the main outfit. Reply with ONLY this JSON:
{ "title": "3-5 word name for the look", "items": [ { "label": "e.g. 'black turtleneck'", "category": one of ${JSON.stringify(CATS)}, "art": closest shape from ${JSON.stringify(ARTS)}, "color": one of ${JSON.stringify(COLOR_NAMES)} } ] }
At most one item per category except accessories (max 2). Do not describe the person.`;
  const r = await ask(prompt, { images: [imageBlob], tier: 'default' });
  if (!r.value) return { error: r.error, offline: r.offline };
  const items = arr(r.value?.items).map((it) => {
    const category = oneOf(it.category, CATS, null);
    if (!category) return null;
    const color = NAMED_COLORS.find((c) => c.name === it.color) || null;
    return { label: str(it.label, 60) || `${color?.name || ''} ${it.art || category}`.trim(), category, art: oneOf(it.art, ARTS[category], ARTS[category][0]), color: color ? { name: color.name, hex: color.hex } : null };
  }).filter(Boolean);
  if (!items.length) return { error: 'The AI could not find clothing in that image.' };
  return { provider: r.provider, title: str(r.value?.title, 60), items };
}

export { short };
