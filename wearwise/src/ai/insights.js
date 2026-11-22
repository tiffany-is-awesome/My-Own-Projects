// Phase 2: wardrobe versatility, Rediscover My Closet, outfit history stats, learned preferences.
// Pure functions over her own data; no AI needed, so everything here works offline and is testable.
import { critique } from './critic.js';
import { candidates, isAvailable, styleWithThis, generateOutfits } from './generator.js';
import { buildContext } from './context.js';
import { OCCASIONS, slotOf } from '../data/closet.js';

const DAY = 86400000;
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / DAY);
export const today = () => new Date().toISOString().slice(0, 10);

// The everyday situations a versatile piece should handle.
export const VERSATILITY_CONTEXTS = [
  { occasion: 'everyday', weather: 'warm' }, { occasion: 'everyday', weather: 'cool' },
  { occasion: 'work', weather: 'cool' }, { occasion: 'date', weather: 'warm' },
  { occasion: 'church', weather: 'warm' }, { occasion: 'vacation', weather: 'hot' },
].map((c) => buildContext(c, OCCASIONS));

const strong = (o, ctx) => { const c = critique(o, ctx); return c.overall >= 75 && !c.dealBreakers.length; };

/** Wear counts and last-worn dates per item, from Outfit History. */
export function wearStats(history) {
  const stats = {};
  for (const h of history) {
    for (const id of Object.values(h.slots || {})) {
      if (!id) continue;
      const s = (stats[id] ||= { wears: 0, last: null });
      s.wears++;
      if (!s.last || h.date > s.last) s.last = h.date;
    }
  }
  return stats;
}

/**
 * Versatility of every available piece: how many strong, distinct outfits it is part of
 * across everyday situations, and in which situations it works.
 * @returns {{ items: [{ item, combos, contexts: string[] }], score: number (0-100), hardToStyle: [] }}
 */
export function versatility(pool, contexts = VERSATILITY_CONTEXTS) {
  const avail = pool.filter(isAvailable);
  const items = avail.filter((g) => ['top', 'bottom', 'outer', 'shoes'].includes(slotOf(g))).map((item) => {
    const partners = new Set();
    let combos = 0;
    const where = [];
    for (const ctx of contexts) {
      const list = candidates(avail, ctx, item, 400).filter(({ o }) => strong(o, ctx));
      combos += list.length;
      for (const { o } of list) for (const k of ['top', 'bottom', 'outer', 'shoes']) if (o[k] && o[k].id !== item.id) partners.add(o[k].id);
      if (list.length) where.push(ctx.occasionLabel + (ctx.weather === 'Hot' || ctx.weather === 'Cool' ? ` (${ctx.weather.toLowerCase()})` : ''));
    }
    return { item, combos, partners: partners.size, contexts: [...new Set(where)] };
  }).sort((a, b) => b.partners - a.partners || b.combos - a.combos);
  const working = items.filter((x) => x.contexts.length >= 2 && x.partners >= 3).length;
  const score = items.length ? Math.round((working / items.length) * 100) : 0;
  return { items, score, hardToStyle: items.filter((x) => x.contexts.length === 0) };
}

/** Why a piece is hard to style: the slot that has nothing suitable to pair with it. */
export function whyHardToStyle(item, pool) {
  const avail = pool.filter(isAvailable);
  const s = slotOf(item);
  const need = s === 'shoes' ? ['top', 'bottom'] : s === 'outer' ? ['top', 'shoes'] : s === 'top' && item.category === 'dress' ? ['shoes'] : s === 'top' ? ['bottom', 'shoes'] : ['top', 'shoes'];
  const lacking = need.filter((slot) => {
    const options = avail.filter((g) => slotOf(g) === slot);
    return !options.some((g) => Math.abs((g.formality || 2) - (item.formality || 2)) <= 1.5);
  });
  if (lacking.length) return `Nothing in the closet ${lacking.length > 1 ? `(${lacking.join(', ')})` : `(${lacking[0]})`} sits at its level of dressiness.`;
  return 'Its colors or style clash with most of the other pieces.';
}

/**
 * Rediscover My Closet: available pieces she hasn't worn in a while (or ever), each with a strong outfit built around it.
 * Items added in the last 14 days are skipped (they're not forgotten, they're new).
 */
export function rediscover(pool, history, { now = today(), ctx = null, contexts = null, limit = 4, minDays = 30 } = {}) {
  const ctxs = contexts || (ctx ? [ctx] : VERSATILITY_CONTEXTS.slice(0, 2));
  const stats = wearStats(history);
  const avail = pool.filter(isAvailable);
  const forgotten = avail
    .filter((g) => ['top', 'bottom', 'outer', 'shoes'].includes(slotOf(g)))
    .filter((g) => !g.addedAt || daysBetween(g.addedAt, now) >= 14)
    .map((g) => ({ item: g, last: stats[g.id]?.last || null, wears: stats[g.id]?.wears || 0 }))
    .filter((x) => !x.last || daysBetween(x.last, now) >= minDays)
    .sort((a, b) => (a.last || '0000') .localeCompare(b.last || '0000'));
  const out = [];
  const usedPartners = new Map(); // keep the suggestions varied: penalise partners already shown
  for (const f of forgotten) {
    if (out.length >= limit) break;
    let best = null;
    for (const c of ctxs) {
      const options = [...styleWithThis(avail, f.item, c).outfits, ...generateOutfits(avail, c, f.item).outfits]
        .filter((o) => !o.critique.dealBreakers.length && o.critique.overall >= 75);
      for (const o of options) {
        const repeat = ['top', 'bottom', 'outer', 'shoes', 'bag', 'accessory'].reduce((a, k) => a + (o.outfit[k] && o.outfit[k].id !== f.item.id ? usedPartners.get(o.outfit[k].id) || 0 : 0), 0);
        const val = o.critique.overall - repeat * 4;
        if (!best || val > best.val) best = { ...o, val, ctx: o.ctx || c };
      }
    }
    if (!best) continue;
    for (const g of Object.values(best.outfit)) if (g && g.id !== f.item.id) usedPartners.set(g.id, (usedPartners.get(g.id) || 0) + 1);
    out.push({ ...f, daysSince: f.last ? daysBetween(f.last, now) : null, outfit: best.outfit, critique: best.critique, why: best.why, ctx: best.ctx });
  }
  return out;
}

export const FEEDBACK_TAGS = [
  { id: 'loved', label: 'Loved it', w: 2 },
  { id: 'compliments', label: 'Got compliments', w: 2 },
  { id: 'comfortable', label: 'Comfortable', w: 1 },
  { id: 'uncomfortable', label: 'Uncomfortable', w: -2 },
  { id: 'too-warm', label: 'Too warm', w: -1 },
  { id: 'too-cold', label: 'Too cold', w: -1 },
  { id: 'too-formal', label: 'Too formal', w: -1 },
  { id: 'too-casual', label: 'Too casual', w: -1 },
  { id: 'not-me', label: "Didn't feel like me", w: -2 },
];

/**
 * Learned taste from rated wears (only the profile's own history).
 * Ratings 1–5 → -2…+2; tags add or subtract. Returns small per-item/color/style nudges for the ranking.
 */
export function preferenceProfile(history, garmentsById, { now = today() } = {}) {
  const items = {}, colors = {}, styles = {};
  const counts = { items: {}, colors: {}, styles: {} };
  let rated = 0;
  for (const h of history) {
    const tagW = (h.tags || []).reduce((a, t) => a + (FEEDBACK_TAGS.find((x) => x.id === t)?.w || 0), 0);
    if (!h.rating && !tagW) continue;
    rated++;
    const v = (h.rating ? h.rating - 3 : 0) + tagW * 0.5;
    for (const id of Object.values(h.slots || {})) {
      const g = id && garmentsById(id);
      if (!g) continue;
      items[id] = (items[id] || 0) + v; counts.items[id] = (counts.items[id] || 0) + 1;
      const col = g.colors?.[0]?.name;
      if (col) { colors[col] = (colors[col] || 0) + v; counts.colors[col] = (counts.colors[col] || 0) + 1; }
      if (g.style) { styles[g.style] = (styles[g.style] || 0) + v; counts.styles[g.style] = (counts.styles[g.style] || 0) + 1; }
    }
  }
  const avg = (sum, n) => Object.fromEntries(Object.entries(sum).map(([k, s]) => [k, Math.max(-3, Math.min(3, s / Math.max(1, n[k] ** 0.5)))]));
  const recent = history.filter((h) => daysBetween(h.date, now) <= 3).flatMap((h) => Object.values(h.slots || {})).filter(Boolean);
  return { items: avg(items, counts.items), colors: avg(colors, counts.colors), styles: avg(styles, counts.styles), recent, rated };
}

/** Plain-language summary of what has been learned, for the History page. */
export function describePreferences(p, garmentsById) {
  const top = (obj, sign) => Object.entries(obj).filter(([, v]) => sign * v >= 1).sort((a, b) => sign * (b[1] - a[1])).slice(0, 3).map(([k]) => k);
  const lines = [];
  const likedItems = top(p.items, 1).map((id) => garmentsById(id)?.name).filter(Boolean);
  const dislikedItems = top(p.items, -1).map((id) => garmentsById(id)?.name).filter(Boolean);
  if (likedItems.length) lines.push(`Favourites: ${likedItems.join(', ')}.`);
  if (top(p.colors, 1).length) lines.push(`Colors that work for you: ${top(p.colors, 1).join(', ')}.`);
  if (top(p.styles, 1).length) lines.push(`Styles you rate highly: ${top(p.styles, 1).join(', ')}.`);
  if (dislikedItems.length) lines.push(`Shown less often: ${dislikedItems.join(', ')}.`);
  return lines;
}
