// Trip planner: one strong outfit per day, all different, re-using pieces so the suitcase stays small.
import { critique } from './critic.js';
import { candidates, isAvailable, describe, explain, missingForOutfit } from './generator.js';

const DAY = 86400000;
export const iso = (d) => new Date(d).toISOString().slice(0, 10);
export function daysBetween(start, end) {
  const out = [];
  for (let t = new Date(start + 'T12:00:00').getTime(); t <= new Date(end + 'T12:00:00').getTime() && out.length < 31; t += DAY) out.push(iso(t));
  return out;
}

const PACK_KEYS = ['top', 'bottom', 'outer', 'shoes', 'bag', 'accessory'];
const coreKey = (o) => ['top', 'bottom', 'outer', 'shoes'].map((k) => o[k]?.id || '-').join('|');
const coreKeyOf = (x) => coreKey(x.outfit || x);

/**
 * Plan a trip.
 * @returns {{ days: [{ date, outfit, critique, name, why }], packing: [{ item, days }], missing: string[], note }}
 */
export function planTrip(pool, ctx, dates, avoid = []) {
  const avoidSet = new Set(avoid.map(coreKeyOf));
  const avail = pool.filter(isAvailable);
  const missing = missingForOutfit(avail);
  if (missing.length) return { days: [], packing: [], missing, note: '' };
  const options = candidates(avail, ctx, null, 300)
    .map(({ o }) => ({ o, c: critique(o, ctx) }))
    .filter(({ c }) => !c.dealBreakers.length && c.overall >= 72);
  if (!options.length) return { days: [], packing: [], missing: [], note: `Nothing in this closet makes a strong outfit for ${ctx.occasionLabel.toLowerCase()} in ${ctx.weather.toLowerCase()} weather.` };

  const packed = new Map(); // item id → count of days used
  const usedOutfits = new Set();
  const days = [];
  let prev = null;
  for (const date of dates) {
    let best = null;
    for (const { o, c } of options) {
      const k = coreKey(o);
      let s = c.overall;
      if (usedOutfits.has(k)) s -= 40;                      // every day looks different
      if (avoidSet.has(k)) s -= 12;                         // "Re-plan": prefer outfits not in the previous plan
      if (prev && o.top?.id === prev.top?.id) s -= 25;      // never the same top two days running
      for (const key of PACK_KEYS) {
        const g = o[key];
        if (!g) continue;
        const n = packed.get(g.id) || 0;
        if (n > 0) s += key === 'top' ? 2 : 7;              // re-wearing bottoms, shoes and layers keeps the bag light
        if (key === 'top' && n >= 2) s -= 12;               // but a top shouldn't be worn on 3+ days
      }
      if (!best || s > best.s) best = { o, c, s, k };
    }
    usedOutfits.add(best.k);
    for (const key of PACK_KEYS) if (best.o[key]) packed.set(best.o[key].id, (packed.get(best.o[key].id) || 0) + 1);
    days.push({ date, outfit: best.o, critique: best.c, name: describe(best.o), why: explain(best.o, best.c, ctx) });
    prev = best.o;
  }
  const byId = new Map(avail.map((g) => [g.id, g]));
  const packing = [...packed.entries()].map(([id, n]) => ({ item: byId.get(id), days: n })).filter((x) => x.item)
    .sort((a, b) => PACK_KEYS.indexOf(slot(a.item)) - PACK_KEYS.indexOf(slot(b.item)) || b.days - a.days);
  const distinct = new Set(days.map((d) => coreKey(d.outfit))).size;
  const note = distinct < days.length ? `Your closet has ${distinct} strong different outfit${distinct > 1 ? 's' : ''} for this trip, so some days repeat. Adding pieces would give more variety.` : '';
  return { days, packing, missing: [], note };
}
const slot = (g) => (g.category === 'dress' ? 'top' : g.category === 'accessory' ? (['tote', 'crossbody'].includes(g.art) ? 'bag' : 'accessory') : g.category);
