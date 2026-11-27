// Outfit generation: deterministic search scored by the critic (no AI involved here).
// Used directly when the AI stylist isn't available, and to VALIDATE the AI's picks when it is.
//
//   generateOutfits(pool, ctx, anchor)      → { outfits: [3 distinct], missing: [] }
//   styleWithThis(pool, anchor, ctx)        → 3+ styling directions around one garment
//   alternatives(outfit, ctx, pool)         → "different shoes / add a jacket / more formal …" (owned items only)
//   explain(outfit, critique, ctx)          → plain-language "why this works"
//   familyLook(members, ctx)                → one coordinated outfit per family member

import { critique, isDress, isComplete, short, comfortOf, occ } from './critic.js';
import { isNeutral, hexToHsl, hueDistance } from './color.js';
import { slotOf } from '../data/closet.js';

export const isAvailable = (g) => !g.status || g.status === 'available';
const CORE = ['top', 'bottom', 'outer', 'shoes'];
const ALL_SLOTS = ['top', 'bottom', 'outer', 'shoes', 'bag', 'accessory'];
const key = (o) => ALL_SLOTS.map((k) => o[k]?.id || '-').join('|');

// ── what's missing for a complete outfit?
export function missingForOutfit(pool) {
  const avail = pool.filter(isAvailable);
  const has = (fn) => avail.some(fn);
  const missing = [];
  const tops = has((g) => slotOf(g) === 'top' && !isDress(g));
  const dresses = has(isDress);
  const bottoms = has((g) => slotOf(g) === 'bottom');
  if (!dresses && !(tops && bottoms)) {
    if (!tops) missing.push('a top');
    if (!bottoms) missing.push('a bottom');
    if (!tops && !bottoms) missing.splice(0, 2, 'a top and a bottom (or a dress)');
  }
  if (!has((g) => slotOf(g) === 'shoes')) missing.push('shoes');
  return missing;
}

// ── single-piece suitability, used to keep the search small and sensible
function pieceFit(g, ctx) {
  let s = 0;
  s -= Math.abs((g.formality ?? 2) - ctx.formality) * 1.4;
  if (g.seasons && !g.seasons.includes(ctx.season)) s -= 2;
  if (g.occasions?.includes(ctx.occasion)) s += 1.5;
  if (ctx.style && g.style === ctx.style) s += 1.5;
  if (ctx.rain >= 0.6 && slotOf(g) === 'shoes') s += (g.water || 1) >= 3 ? 1.5 : -2;
  if (ctx.tempC >= 27 && g.weight === 'heavy') s -= 2;
  if (ctx.tempC <= 10 && g.weight === 'light' && g.category !== 'accessory') s -= 1;
  if (ctx.prefs?.includes('comfortable')) s += (comfortOf(g) - 2) * 0.8;
  return s;
}
const topN = (items, ctx, n, keep) => {
  const ranked = [...items].sort((a, b) => pieceFit(b, ctx) - pieceFit(a, ctx)).slice(0, n);
  if (keep && items.includes(keep) && !ranked.includes(keep)) ranked.push(keep);
  return ranked;
};

/** Best bag + accessory (or none) for an outfit, from her closet. */
function accessorize(o, ctx, pool, anchor, used = new Set()) {
  let best = { ...o };
  for (const slot of ['bag', 'accessory']) {
    if (anchor && slotOf(anchor) === slot) { best[slot] = anchor; continue; }
    const options = [null, ...pool.filter((g) => slotOf(g) === slot)];
    let bestScore = -1, pick = null;
    for (const c of options) {
      // a tie goes to the finished look; a bag/accessory already used in another suggestion needs to be
      // clearly better (2+ points) to be picked again, so the three looks don't all carry the same tote
      const sc = critique({ ...best, [slot]: c }, ctx).overall + (c ? 0.5 : 0) - (c && used.has(c.id) ? 2 : 0);
      if (sc > bestScore) { bestScore = sc; pick = c; }
    }
    best = { ...best, [slot]: pick };
  }
  return best;
}

/**
 * Ranking score: the critic's overall score, plus
 *  - a hard push-down for practical problems (rain-unsafe shoes, too hot/cold), which must never win;
 *  - extra weight for the style she picked.
 */
function rank(o, ctx) {
  const c = critique(o, ctx);
  let s = c.overall;
  const weather = c.pillars.find((p) => p.id === 'fabric').score;
  if (weather < 65) s -= (65 - weather) * 1.5;
  // Deal-breakers: never let these win, whatever else scores well
  const sh = o.shoes;
  if (ctx.rain >= 0.6 && sh && ((sh.water || 1) <= 1 || sh.art === 'sandal')) s -= 30;
  if (ctx.tempC < 15 && sh?.art === 'sandal') s -= 20;
  if (ctx.tempC >= 27 && CORE.some((k) => o[k]?.weight === 'heavy' && k !== 'shoes')) s -= 20;
  if (ctx.style) {
    const core = CORE.map((k) => o[k]).filter((i) => i?.style);
    const match = core.length ? core.filter((i) => i.style === ctx.style).length / core.length : 0;
    s += match * 10;
  }
  if (ctx.personal) s += personalBonus(o, ctx.personal);
  return s;
}

/**
 * Learned taste (from her ratings in Outfit History) nudges the ranking, within ±8 points,
 * so it can choose between good outfits but never rescue a bad one (deal-breakers still cap the score).
 */
export function personalBonus(o, p) {
  if (!p) return 0;
  let b = 0;
  for (const k of [...CORE, 'bag', 'accessory']) {
    const i = o[k];
    if (!i) continue;
    b += p.items?.[i.id] || 0;
    if (k !== 'bag' && k !== 'accessory') {
      b += (p.colors?.[i.colors?.[0]?.name] || 0) * 0.5;
      b += (p.styles?.[i.style] || 0) * 0.5;
    }
    if (p.recent?.includes(i.id) && k !== 'shoes' && k !== 'bag') b -= 1.5; // worn in the last few days: a little variety
  }
  return Math.max(-8, Math.min(8, b));
}

/** All reasonable complete outfits, best first. */
export function candidates(pool, ctx, anchor, limit = 60) {
  const avail = pool.filter(isAvailable);
  const aSlot = anchor ? slotOf(anchor) : null;
  const of = (slot, filter = () => true) => avail.filter((g) => slotOf(g) === slot && filter(g));
  const tops = aSlot === 'top' ? [anchor] : topN(of('top'), ctx, 9);
  const bottoms = aSlot === 'bottom' ? [anchor] : topN(of('bottom'), ctx, 8);
  const shoes = aSlot === 'shoes' ? [anchor] : topN(of('shoes'), ctx, 6);
  const outers = aSlot === 'outer' ? [anchor] : [null, ...topN(of('outer'), ctx, 5)];
  const scored = [];
  for (const top of tops) {
    const bots = isDress(top) ? [null] : (aSlot === 'bottom' ? bottoms : bottoms);
    if (isDress(top) && aSlot === 'bottom') continue; // anchor bottom can't go with a dress
    for (const bottom of bots) {
      if (!isDress(top) && !bottom) continue;
      for (const sh of shoes) for (const outer of outers) {
        const o = { top, bottom, outer, shoes: sh, bag: aSlot === 'bag' ? anchor : null, accessory: aSlot === 'accessory' ? anchor : null };
        scored.push({ o, score: rank(o, ctx) });
      }
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

/** Describe an outfit's character in a few words, e.g. "Polished · Classic". */
const TC = (t) => t.replace(/\b([a-z])/g, (m) => m.toUpperCase());

/** A memorable, descriptive name from the two pieces that define the look, e.g. "Olive Trousers & Black Turtleneck". */
export function describe(o) {
  const hero = (i) => i && (i.pattern && i.pattern !== 'solid' ? 3 : 0) + (isNeutralItem(i) ? 0 : 2) + (i.category === 'dress' ? 2 : 0);
  const pieces = ['top', 'bottom', 'outer'].map((k) => o[k]).filter(Boolean);
  if (!pieces.length) return 'New look';
  const [a, ...rest] = pieces;
  const b = rest.sort((x, y) => hero(y) - hero(x))[0];
  const second = b || o.shoes;
  return second ? `${TC(short(a))} & ${TC(short(second))}` : TC(short(a));
}
const NEUTRALS = /^(black|white|off-white|ivory|cream|gray|grey|charcoal|beige|camel|navy|khaki|brown|taupe|stone)/;
const isNeutralItem = (i) => NEUTRALS.test(i.colors?.[0]?.name || '');

/** The outfit's mood, e.g. "Polished · Classic" (shown under the name). */
export function vibeOf(o) {
  const core = CORE.map((k) => o[k]).filter(Boolean);
  const f = core.reduce((a, i) => a + (i.formality || 2), 0) / (core.length || 1);
  const level = f >= 3.4 ? 'Polished' : f >= 2.3 ? 'Smart' : 'Relaxed';
  const counts = {};
  core.forEach((i) => { if (i.style) counts[i.style] = (counts[i.style] || 0) + 1; });
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const LABEL = { business: 'Business casual', streetwear: 'Street', casual: 'Easy' };
  return top ? `${level} · ${LABEL[top] || top.charAt(0).toUpperCase() + top.slice(1)}` : level;
}

/** Plain-language explanation (no jargon) built from the strongest findings. */
export function explain(o, c, ctx) {
  // Written like a stylist: color story → shape → why it suits the day → one thing to watch.
  const P = Object.fromEntries(c.pillars.map((p) => [p.id, p]));
  const cons = c.pillars.filter((p) => p.cons.length).sort((a, b) => a.score - b.score).flatMap((p) => p.cons);
  const lower = (t) => t.charAt(0).toLowerCase() + t.slice(1).replace(/\.$/, '');
  const parts = [];
  const color = P.color?.pros[0];
  const shape = P.proportions?.pros.find((t) => /column|anchor|balanced|line/.test(t)) || P.proportions?.pros[0];
  if (color) parts.push(color.replace(/\.$/, '') + '.');
  if (shape && parts.length < 2) {
    const m = shape.match(/^The (\w+) (.+?) (are|is) balanced by (.+)$/);
    const again = m && color && color.includes(m[2]);
    parts.push(again ? `${m[3] === 'are' ? 'Their' : 'Its'} ${m[1]} cut is balanced by ${m[4].replace(/\.$/, '')}.` : shape.replace(/\.$/, '') + '.');
  }
  const practical = [...(P.fabric?.pros || [])].filter((t) => /rain|puddle|drizzle|breath|cool|warm enough|layer/i.test(t))[0];
  const fit = (P.occasion?.score ?? 0) >= 80 ? `Right for ${occ(ctx)}` : `Works for ${occ(ctx)}`;
  parts.push(`${fit} at ${ctx.tempC}°C${practical ? `, and ${lower(practical).replace(/\s*\([^)]*\)/g, '')}` : ''}.`);
  const said = parts.join(' ');
  const finish = (P.finish?.pros || []).find((t) => /finishes|point of interest|keep it|pull it together/.test(t) && !said.includes((t.match(/^The (.+?) (adds|finishes|keep|pull)/) || [])[1] || '§'));
  if (finish && parts.length < 4) parts.push(finish.replace(/\.$/, '') + '.');
  if (cons.length) parts.push(`Watch: ${lower(cons[0])}.`);
  return parts.join(' ');
}

function personalNote(o, ctx) {
  const liked = ctx.personal ? [...CORE, 'bag', 'accessory'].map((k) => o[k]).filter((i) => i && (ctx.personal.items?.[i.id] || 0) >= 2) : [];
  return liked.length ? ` Includes ${liked.length > 1 ? 'pieces' : 'a piece'} you rated highly before (the ${liked.slice(0, 2).map(short).join(' and ')}).` : '';
}

const shared = (a, b) => CORE.filter((k) => a[k] && b[k] && a[k].id === b[k].id).length;

/**
 * Three distinct, genuinely good outfits from HER available clothes.
 * @returns {{ outfits: Array<{ name, outfit, critique, why }>, missing: string[] }}
 */
/** The quality bar for a suggestion to be shown as a recommendation (the "Good outfit" verdict starts at 78). */
export const GOOD = 76;

export function generateOutfits(pool, ctx, anchor = null) {
  const missing = missingForOutfit(pool);
  if (missing.length) return { outfits: [], missing };
  if (anchor && !isAvailable(anchor)) return { outfits: [], missing: [], unavailable: anchor };
  const avail = pool.filter(isAvailable);
  const list = candidates(avail, ctx, anchor);
  // Variety: how much two outfits overlap. A shared top/bottom/outer layer/shoes counts 1, a shared bag or
  // accessory ½. The anchor piece ("style me with this") is in every outfit on purpose, so it doesn't count.
  const anchorId = anchor?.id;
  const overlap = (a, b) => [...CORE, 'bag', 'accessory'].reduce((n, k) =>
    n + (a[k] && b[k] && a[k].id === b[k].id && a[k].id !== anchorId ? (CORE.includes(k) ? 1 : 0.5) : 0), 0);
  const chosen = [];
  for (const limit of [1, 2]) { // first: clearly different looks; then: at least half of each look different
    for (const { o } of list) {
      if (chosen.length >= 3) break;
      if (chosen.some((c) => key(c.o) === key(o) || overlap(c.o, o) > limit)) continue;
      chosen.push({ o });
    }
  }
  const tooSimilar = chosen.length < 3 && list.length > chosen.length; // more were possible, but only as near-copies
  const usedExtras = new Set();
  const outfits = chosen.map(({ o }) => {
    const full = accessorize(o, ctx, avail, anchor, usedExtras);
    ['bag', 'accessory'].forEach((k) => full[k] && usedExtras.add(full[k].id));
    const c = critique(full, ctx);
    return { name: describe(full), vibe: vibeOf(full), outfit: full, critique: c, why: explain(full, c, ctx) + personalNote(full, ctx), weak: c.dealBreakers.length > 0 };
  });
  // Never pad with mediocre outfits: show only good ones (no deal-breaker, score ≥ GOOD). If none reach the bar,
  // show the single closest option, clearly labelled.
  const strong = outfits.filter((x) => !x.weak && x.critique.overall >= GOOD);
  const shown = (strong.length ? strong : outfits.slice(0, 1)).sort((a, b) => b.critique.overall - a.critique.overall);
  const note = shown.length < 3
    ? (strong.length
      ? `Only ${strong.length} good${tooSimilar ? ', different' : ''} outfit${strong.length > 1 ? 's' : ''} can be made from this closet for ${occ(ctx)}, so that's all you're shown${tooSimilar ? ' (others would repeat the same pieces)' : ''}. Adding pieces would give more choice.`
      : `This closet can't make a really good outfit for ${occ(ctx)} yet. Here's the closest option, with what to watch.`)
    : '';
  return { outfits: shown, missing: [], note };
}

// ── Style me with this: several styling DIRECTIONS around one garment
export const DIRECTIONS = [
  { id: 'casual', name: 'Casual', ctx: { formality: 2, style: 'casual', prefs: ['comfortable'] } },
  { id: 'elegant', name: 'Elegant', ctx: { formality: 4, style: 'elegant', prefs: [] } },
  { id: 'minimal', name: 'Minimalist', ctx: { style: 'minimalist', prefs: ['simple'] } },
  { id: 'trendy', name: 'Trendy', ctx: { style: 'streetwear', prefs: ['standout'] } },
];
export function styleWithThis(pool, anchor, ctx) {
  const avail = pool.filter(isAvailable);
  if (!anchor || !avail.includes(anchor)) return { outfits: [], missing: [], unavailable: anchor };
  const missing = missingForOutfit(avail);
  if (missing.length) return { outfits: [], missing };
  const dirs = [{ id: 'occasion', name: `For ${(ctx.occasionLabel || 'today').toLowerCase()}`, ctx: {} }, ...DIRECTIONS];
  const out = [];
  for (const d of dirs) {
    const dctx = { ...ctx, ...d.ctx, prefs: [...(ctx.prefs || []).filter((p) => !['simple', 'standout'].includes(p)), ...(d.ctx.prefs || [])] };
    const list = candidates(avail, dctx, anchor, 25);
    const pick = list.find(({ o }) => !out.some((x) => key(x.raw) === key(o) || shared(x.raw, o) >= 3));
    if (!pick) continue;
    const full = accessorize(pick.o, dctx, avail, anchor);
    const c = critique(full, dctx);
    if (c.overall < 55 && out.length >= 3) continue;   // only keep weak directions if we'd have fewer than 3
    out.push({ raw: pick.o, name: d.name, direction: d.id, outfit: full, critique: c, why: explain(full, c, dctx), ctx: dctx });
    if (out.length >= 4) break;
  }
  return { outfits: out.map(({ raw, ...r }) => r), missing: [] };
}

// ── Alternatives she owns
const formalityOf = (o) => { const c = CORE.map((k) => o[k]).filter(Boolean); return c.reduce((a, i) => a + (i.formality || 2), 0) / (c.length || 1); };
const accentsOf = (o) => ALL_SLOTS.map((k) => o[k]).filter(Boolean).flatMap((i) => i.colors).filter((c) => !isNeutral(c.name)).length;

export function alternatives(o, ctx, pool) {
  const avail = pool.filter(isAvailable);
  const base = critique(o, ctx).overall;
  const out = [];
  const bestSwap = (slots, filter, scoreFn, minScore) => {
    let best = null;
    for (const slot of slots) {
      for (const g of avail.filter((x) => slotOf(x) === slot && x.id !== o[slot]?.id && filter(x, slot))) {
        const next = { ...o, [slot]: g };
        if (slot === 'top' && isDress(g)) next.bottom = null;
        if (!isComplete(next)) continue;
        const sc = critique(next, ctx).overall;
        if (sc < minScore) continue;
        const v = scoreFn(next, sc);
        if (!best || v > best.v) best = { v, next, sc, piece: g };
      }
    }
    return best;
  };
  const push = (id, label, r) => { if (r) out.push({ id, label: label(r.piece), outfit: r.next, score: r.sc, delta: r.sc - base }); };
  push('shoes', (p) => `Different shoes: ${p.name}`, bestSwap(['shoes'], () => true, (_, sc) => sc, base - 10));
  push('top', (p) => `Replace the ${isDress(o.top) ? 'dress' : 'top'}: ${p.name}`, bestSwap(['top'], (x) => isDress(x) === isDress(o.top), (_, sc) => sc, base - 10));
  if (!o.outer) push('jacket', (p) => `Add a jacket: ${p.name}`, bestSwap(['outer'], () => true, (_, sc) => sc, base - 8));
  const f0 = formalityOf(o);
  push('formal', (p) => `More formal: ${p.name}`, bestSwap(['top', 'bottom', 'outer', 'shoes'], (x, slot) => (x.formality || 2) > (o[slot]?.formality ?? 0), (n, sc) => (formalityOf(n) - f0) * 12 + sc, base - 14));
  push('casual', (p) => `More casual: ${p.name}`, bestSwap(['top', 'bottom', 'outer', 'shoes'], (x, slot) => (x.formality || 2) < (o[slot]?.formality ?? 9), (n, sc) => (f0 - formalityOf(n)) * 12 + sc, base - 14));
  if (!o.bag || !o.accessory) push('accessory', (p) => `Add ${p.category === 'accessory' ? 'an accessory' : 'a piece'}: ${p.name}`, bestSwap([!o.bag ? 'bag' : null, !o.accessory ? 'accessory' : null].filter(Boolean), () => true, (_, sc) => sc, base - 5));
  const a0 = accentsOf(o);
  push('colorful', (p) => `More colorful: ${p.name}`, bestSwap(ALL_SLOTS, (x) => x.colors.some((c) => !isNeutral(c.name)), (n, sc) => (accentsOf(n) > a0 ? 20 : 0) + sc, base - 12));
  // de-duplicate (two goals can land on the same change)
  const seen = new Set();
  return out.filter((a) => (a.delta >= -14) && !seen.has(key(a.outfit)) && seen.add(key(a.outfit)));
}

// ── Family looks: one outfit per member, coordinated
function paletteOf(o) {
  return ALL_SLOTS.map((k) => o[k]).filter(Boolean).flatMap((i) => i.colors).filter((c) => !isNeutral(c.name));
}
export function coordination(outfits) {
  const pros = [], cons = [];
  let s = 0;
  const palettes = outfits.map(paletteOf);
  const names = palettes.map((p) => new Set(p.map((c) => c.name)));
  const all = [...new Set(palettes.flat().map((c) => c.name))];
  // shared accent across most of the family
  const sharedAccent = all.find((n) => names.filter((set) => set.has(n)).length >= Math.max(2, Math.ceil(outfits.length * 0.6)));
  if (sharedAccent) { s += 14; pros.push(`A shared thread of ${sharedAccent} ties everyone together.`); }
  if (all.length === 0) { s += 3; pros.push('An all-neutral family palette looks calm and coordinated.'); }
  else if (all.length === 1 && !sharedAccent) { s += 2; pros.push(`One splash of ${all[0]} brightens an otherwise neutral family palette.`); }
  if (all.length >= 4) { s -= 6 * (all.length - 3); cons.push(`Too many different colors across the family (${all.slice(0, 5).join(', ')}).`); }
  // accent hues should harmonise (analogous or complementary)
  const hexes = [...new Map(palettes.flat().map((c) => [c.name, c.hex])).values()];
  for (let i = 0; i < hexes.length; i++) for (let j = i + 1; j < hexes.length; j++) {
    const d = hueDistance(hexToHsl(hexes[i])[0], hexToHsl(hexes[j])[0]);
    if (d > 45 && d < 140) { s -= 5; }
  }
  // same level of dressiness
  const f = outfits.map(formalityOf);
  const spread = Math.max(...f) - Math.min(...f);
  if (spread <= 1) { s += 8; pros.push('Everyone is dressed to the same level.'); }
  else if (spread > 1.6) { s -= 12; cons.push('Dressiness is uneven: one person looks much more formal than the others.'); }
  // not identical uniforms
  for (let i = 0; i < outfits.length; i++) for (let j = i + 1; j < outfits.length; j++) {
    const a = outfits[i].top, b = outfits[j].top;
    if (a && b && a.colors[0].name === b.colors[0].name && a.art === b.art) { s -= 8; cons.push('Two people would be wearing near-identical tops. Coordinated beats matching.'); }
  }
  return { score: s, pros, cons };
}

/**
 * @param members [{ profile, pool }] each member's OWN closet
 * @returns {{ members: [{ profile, outfit, critique }], coordination, why, missing: [{ name, missing }] }}
 */
export function familyLook(members, ctx) {
  const missing = members.map((m) => ({ name: m.profile.name, missing: missingForOutfit(m.pool) })).filter((m) => m.missing.length);
  if (missing.length) return { members: [], missing };
  const lists = members.map((m) => {
    const mctx = m.profile.kind === 'child' ? { ...ctx, formality: Math.max(1, ctx.formality - 0.5) } : ctx;
    return candidates(m.pool, mctx, null, 30).filter((x, i, arr) => arr.findIndex((y) => key(y.o) === key(x.o)) === i).slice(0, members.length > 3 ? 4 : 6).map((x) => ({ ...x, ctx: mctx }));
  });
  let best = null;
  const walk = (i, picked) => {
    if (i === lists.length) {
      const outfits = picked.map((p) => p.o);
      const co = coordination(outfits);
      const total = picked.reduce((a, p) => a + p.score, 0) / picked.length + co.score * 0.7;
      if (!best || total > best.total) best = { total, picked, co };
      return;
    }
    for (const c of lists[i]) walk(i + 1, [...picked, c]);
  };
  walk(0, []);
  const result = members.map((m, i) => {
    const o = accessorize(best.picked[i].o, best.picked[i].ctx, m.pool.filter(isAvailable), null);
    return { profile: m.profile, outfit: o, critique: critique(o, best.picked[i].ctx) };
  });
  const co = coordination(result.map((r) => r.outfit));
  const why = [co.pros[0], co.pros[1]].filter(Boolean).join(' ') + (co.cons[0] ? ` One thing to watch: ${co.cons[0].charAt(0).toLowerCase()}${co.cons[0].slice(1)}` : '');
  return { members: result, coordination: co, why: why || 'Each outfit suits the occasion on its own, and the palettes sit well together.', missing: [] };
}
