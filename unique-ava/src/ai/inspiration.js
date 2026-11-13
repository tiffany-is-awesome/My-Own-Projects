// Fashion Inspiration Bridge (prototype).
// Production: Gemini vision decomposes a user-supplied photo/link into items, and pgvector
// matches them to the closet. Here, a look is described in text and decomposed by keywords.

import { NAMED_COLORS, hexToHsl, isNeutral } from './color.js';

const NOUNS = [
  ['stripe', 'top', 'stripe'], ['breton', 'top', 'stripe'], ['turtleneck', 'top', 'turtleneck'], ['t-shirt', 'top', 'tee'], ['tee', 'top', 'tee'], ['shirt', 'top', 'shirt'],
  ['sweater', 'top', 'knit'], ['knit', 'top', 'knit'], ['jumper', 'top', 'knit'],
  ['jeans', 'bottom', 'jeans'], ['denim', 'bottom', 'jeans'], ['shorts', 'bottom', 'shorts'], ['skirt', 'bottom', 'skirt'],
  ['trousers', 'bottom', 'trousers'], ['pants', 'bottom', 'trousers'], ['chinos', 'bottom', 'trousers'],
  ['trench', 'outer', 'trench'], ['blazer', 'outer', 'blazer'], ['coat', 'outer', 'coat'], ['puffer', 'outer', 'puffer'],
  ['cardigan', 'outer', 'cardigan'], ['jacket', 'outer', 'jacket'],
  ['sneakers', 'shoes', 'sneaker'], ['loafers', 'shoes', 'loafer'], ['boots', 'shoes', 'boot'], ['sandals', 'shoes', 'sandal'],
  ['crossbody', 'accessory', 'crossbody'], ['tote', 'accessory', 'tote'], ['bag', 'accessory', 'crossbody'], ['scarf', 'accessory', 'scarf'],
];

/** "black turtleneck, olive trousers, white sneakers" → [{category, art, color}] */
export function decomposeLook(text) {
  const parts = text.toLowerCase().split(/,|\+|\band\b|\bwith\b|;|\n/).map((s) => s.trim()).filter(Boolean);
  const items = [];
  for (const p of parts) {
    const noun = NOUNS.find(([w]) => p.includes(w));
    if (!noun) continue;
    const color = [...NAMED_COLORS].sort((a, b) => b.name.length - a.name.length).find((c) => p.includes(c.name))
      || (p.includes('blue') ? NAMED_COLORS.find((c) => c.name === 'denim blue') : null)
      || (noun[2] === 'jeans' ? NAMED_COLORS.find((c) => c.name === 'denim blue') : null);
    items.push({ label: p, category: noun[1], art: noun[2], color: color ? { name: color.name, hex: color.hex } : null });
  }
  return items;
}

function similarity(want, g) {
  if (g.category !== want.category) return 0;
  let colorScore = 0;
  if (!want.color) colorScore = 0.8; // color not specified in the look
  else for (const c of g.colors) {
    let cs;
    if (c.name === want.color.name) cs = 1;
    else if (isNeutral(c.name) && isNeutral(want.color.name)) {
      const dl = Math.abs(hexToHsl(c.hex)[2] - hexToHsl(want.color.hex)[2]);
      cs = dl < 0.15 ? 0.7 : 0.35;
    } else cs = 0.15;
    colorScore = Math.max(colorScore, cs);
  }
  const shapeScore = g.art === want.art ? 1 : 0.55;
  return 0.6 * colorScore + 0.4 * shapeScore;
}

/** Map a decomposed look onto the closet → coverage, matches, missing. */
export function matchLook(items, closet) {
  const used = new Set();
  const matches = [], missing = [];
  for (const want of items) {
    let best = null, bestS = 0;
    for (const g of closet) {
      if (used.has(g.id) || g.placeholder) continue;
      const s = similarity(want, g);
      if (s > bestS) { bestS = s; best = g; }
    }
    if (best && bestS >= 0.62) { used.add(best.id); matches.push({ want, garment: best, score: bestS, exact: bestS >= 0.95 }); }
    else missing.push(want);
  }
  const coverage = items.length ? Math.round((matches.length / items.length) * 100) : 0;
  return { coverage, matches, missing };
}

export const SAMPLE_INSPIRATION = [
  {
    id: 'insp-1', title: 'Gallery Opening Minimal', source: 'Sample street-style look', mood: '#2B2B2B',
    text: 'black turtleneck, olive trousers, black boots, black crossbody bag',
  },
  {
    id: 'insp-2', title: 'Parisian Weekend', source: 'Sample street-style look', mood: '#C9B79C',
    text: 'navy stripe tee, denim jeans, beige trench, white sneakers, tote',
  },
  {
    id: 'insp-3', title: 'Rainy City Commute', source: 'Sample street-style look', mood: '#5E6B78',
    text: 'cream knit sweater, black trousers, charcoal coat, black boots, burgundy scarf',
  },
  {
    id: 'insp-4', title: 'Seaside Linen', source: 'Sample street-style look', mood: '#BFD3DB',
    text: 'off-white linen shirt, beige shorts, brown sandals, tote',
  },
];
