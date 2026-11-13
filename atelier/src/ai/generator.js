// Context-aware Mix & Match: three distinct outfit variations.
// Deterministic search scored by the critic, then three "personas" pick diverse winners.
// See docs/ARCHITECTURE.md §4.3.

import { critique, warmthNeeded, warmthOf } from './critic.js';

export const PERSONAS = [
  { id: 'classic', name: 'Safe & Classic', blurb: 'Clean, proven combinations that never miss.' },
  { id: 'cozy', name: 'Layered & Cozy', blurb: 'More texture and a layer to play with.' },
  { id: 'smart', name: 'Smart Casual', blurb: 'One notch sharper than the room.' },
];

function personaScore(persona, outfit, ctx) {
  const c = critique(outfit, ctx);
  const p = Object.fromEntries(c.pillars.map((x) => [x.id, x.score]));
  // Practicality is non-negotiable: any variation that fails the weather is pushed down hard.
  const practicality = p.fabric < 65 ? (65 - p.fabric) * 1.2 : 0;
  let s = withPenalty(persona, outfit, ctx, c, p);
  return { s: s - practicality, c };
}

function withPenalty(persona, outfit, ctx, c, p) {
  let s;
  if (persona === 'classic') s = c.overall + 0.15 * p.color + 0.1 * p.occasion - (outfit.outer && ctx.tempC > 24 ? 10 : 0);
  else if (persona === 'cozy') {
    const margin = warmthOf(outfit) - warmthNeeded(ctx.tempC);
    s = c.overall + (outfit.outer ? 8 : -12) + (margin >= 0 && margin <= 2.5 ? 6 : 0)
      + (['knit', 'turtleneck', 'cardigan'].includes(outfit.top?.art) ? 6 : 0);
    if (ctx.tempC >= 27) { // nobody wants "cozy" at 30°C: this slot becomes "Light & Breezy"
      const airy = ['top', 'bottom'].filter((k) => outfit[k]?.weight === 'light' || /linen/i.test(outfit[k]?.material || '')).length;
      s = c.overall + airy * 5 - (outfit.outer ? 15 : 0);
    }
  } else {
    const smartCtx = { ...ctx, formality: Math.min(5, ctx.formality + 1) };
    s = 0.6 * critique(outfit, smartCtx).overall + 0.4 * c.overall;
  }
  return s;
}

const BREEZY = { id: 'cozy', name: 'Light & Breezy', blurb: 'Airy fabrics, nothing extra.' };
export const personaFor = (p, ctx) => (p.id === 'cozy' && ctx.tempC >= 27 ? BREEZY : p);

/**
 * @param pool    owned garments + placeholder basics
 * @param ctx     parsed context
 * @param anchor  optional garment that must appear
 */
export function generateOutfits(pool, ctx, anchor = null) {
  const by = (cat) => pool.filter((g) => g.category === cat);
  const slot = (cat) => (anchor && anchor.category === cat ? [anchor] : by(cat));
  const tops = slot('top'), bottoms = slot('bottom'), shoes = slot('shoes');
  const outers = anchor?.category === 'outer' ? [anchor] : [null, ...by('outer')];

  const combos = [];
  for (const top of tops) for (const bottom of bottoms) for (const sh of shoes) for (const outer of outers) {
    const placeholders = [top, bottom, sh, outer].filter((x) => x?.placeholder).length;
    combos.push({ top, bottom, shoes: sh, outer, accessory: null, placeholders });
  }

  // Accessory: practical pick (scarf when cold, crossbody/tote otherwise), anchor wins.
  const acc = anchor?.category === 'accessory' ? anchor
    : ctx.tempC <= 10 ? by('accessory').find((a) => a.art === 'scarf')
    : by('accessory').find((a) => !a.placeholder && a.art !== 'scarf');

  const chosen = [];
  const used = new Map();
  for (const persona of PERSONAS) {
    let best = null;
    for (const o of combos) {
      const { s, c } = personaScore(persona.id, o, ctx);
      // diversity: penalize re-using items already picked by an earlier persona
      const reuse = ['top', 'bottom', 'shoes', 'outer'].reduce((n, k) => n + (o[k] && used.has(o[k].id) && o[k] !== anchor ? 1 : 0), 0);
      const score = s - reuse * 7 - o.placeholders * 4;
      if (!best || score > best.score) best = { score, outfit: o, c };
    }
    const outfit = { ...best.outfit, accessory: acc || null };
    delete outfit.placeholders;
    for (const k of ['top', 'bottom', 'shoes', 'outer']) if (outfit[k]) used.set(outfit[k].id, true);
    chosen.push({ persona: personaFor(persona, ctx), outfit, critique: critique(outfit, ctx) });
  }
  return chosen;
}
