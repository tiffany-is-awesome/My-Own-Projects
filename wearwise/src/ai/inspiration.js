// Fashion Inspiration Bridge (prototype).
// Production: Gemini vision decomposes a user-supplied photo/link into items, and pgvector
// matches them to the closet. Here, a look is described in text and decomposed by keywords.

import { NAMED_COLORS, hexToHsl, isNeutral, hueDistance } from './color.js';

// Words people actually use → [category, closest garment type]. Longer phrases are checked first.
const NOUNS = [
  ['long sleeve', 'top', 'tee'], ['t-shirt', 'top', 'tee'], ['tshirt', 'top', 'tee'], ['tank', 'top', 'tee'], ['cami', 'top', 'tee'], ['crop top', 'top', 'tee'], ['tee', 'top', 'tee'], ['top', 'top', 'tee'],
  ['stripe', 'top', 'stripe'], ['breton', 'top', 'stripe'], ['turtleneck', 'top', 'turtleneck'], ['mock neck', 'top', 'turtleneck'], ['polo', 'top', 'shirt'],
  ['blouse', 'top', 'shirt'], ['button-down', 'top', 'shirt'], ['button down', 'top', 'shirt'], ['oxford', 'top', 'shirt'], ['shirt', 'top', 'shirt'],
  ['sweatshirt', 'top', 'knit'], ['hoodie', 'top', 'knit'], ['sweater', 'top', 'knit'], ['knit', 'top', 'knit'], ['jumper', 'top', 'knit'], ['pullover', 'top', 'knit'],
  ['jeans', 'bottom', 'jeans'], ['denim', 'bottom', 'jeans'], ['shorts', 'bottom', 'shorts'], ['skirt', 'bottom', 'skirt'], ['skort', 'bottom', 'skirt'],
  ['trousers', 'bottom', 'trousers'], ['pants', 'bottom', 'trousers'], ['chinos', 'bottom', 'trousers'], ['slacks', 'bottom', 'trousers'], ['culottes', 'bottom', 'trousers'],
  ['joggers', 'bottom', 'trousers'], ['leggings', 'bottom', 'trousers'], ['cargo', 'bottom', 'trousers'],
  ['dress', 'dress', 'dress'], ['gown', 'dress', 'dress'], ['jumpsuit', 'dress', 'dress'],
  ['trench', 'outer', 'trench'], ['raincoat', 'outer', 'trench'], ['mac', 'outer', 'trench'], ['blazer', 'outer', 'blazer'], ['suit jacket', 'outer', 'blazer'],
  ['puffer', 'outer', 'puffer'], ['down jacket', 'outer', 'puffer'], ['parka', 'outer', 'coat'], ['overcoat', 'outer', 'coat'], ['coat', 'outer', 'coat'],
  ['cardigan', 'outer', 'cardigan'], ['shacket', 'outer', 'jacket'], ['bomber', 'outer', 'jacket'], ['jacket', 'outer', 'jacket'], ['vest', 'outer', 'jacket'],
  ['sneakers', 'shoes', 'sneaker'], ['trainers', 'shoes', 'sneaker'], ['sneaker', 'shoes', 'sneaker'], ['loafers', 'shoes', 'loafer'], ['loafer', 'shoes', 'loafer'],
  ['flats', 'shoes', 'loafer'], ['ballet', 'shoes', 'loafer'], ['mules', 'shoes', 'loafer'], ['oxfords', 'shoes', 'loafer'], ['pumps', 'shoes', 'loafer'], ['heels', 'shoes', 'sandal'],
  ['boots', 'shoes', 'boot'], ['boot', 'shoes', 'boot'], ['booties', 'shoes', 'boot'], ['sandals', 'shoes', 'sandal'], ['slides', 'shoes', 'sandal'], ['flip flops', 'shoes', 'sandal'], ['espadrilles', 'shoes', 'sandal'],
  ['crossbody', 'accessory', 'crossbody'], ['shoulder bag', 'accessory', 'crossbody'], ['clutch', 'accessory', 'crossbody'], ['purse', 'accessory', 'crossbody'], ['handbag', 'accessory', 'crossbody'],
  ['tote', 'accessory', 'tote'], ['backpack', 'accessory', 'tote'], ['bag', 'accessory', 'crossbody'],
  ['scarf', 'accessory', 'scarf'], ['hat', 'accessory', 'hat'], ['cap', 'accessory', 'hat'], ['beret', 'accessory', 'hat'], ['beanie', 'accessory', 'hat'],
  ['necklace', 'accessory', 'necklace'], ['pendant', 'accessory', 'necklace'], ['chain', 'accessory', 'necklace'], ['belt', 'accessory', 'belt'],
];
const NOUNS_SORTED = NOUNS.slice().sort((a, b) => b[0].length - a[0].length);

// Everyday color words → the app's named colors.
const COLOR_WORDS = [
  ['off white', 'off-white'], ['ivory', 'cream'], ['ecru', 'cream'], ['oatmeal', 'beige'], ['sand', 'beige'], ['nude', 'beige'], ['stone', 'beige'], ['tan', 'camel'], ['cognac', 'brown'], ['chocolate', 'brown'],
  ['grey', 'gray'], ['silver', 'light gray'], ['heather', 'gray'], ['slate', 'charcoal'], ['jet', 'black'],
  ['indigo', 'denim blue'], ['blue jeans', 'denim blue'], ['cobalt', 'denim blue'], ['royal blue', 'denim blue'], ['sky', 'light blue'], ['baby blue', 'light blue'], ['powder blue', 'light blue'], ['midnight', 'navy'], ['blue', 'denim blue'],
  ['sage', 'olive'], ['army', 'olive'], ['khaki green', 'olive'], ['forest', 'green'], ['emerald', 'green'], ['mint', 'green'],
  ['maroon', 'burgundy'], ['wine', 'burgundy'], ['oxblood', 'burgundy'], ['plum', 'burgundy'], ['scarlet', 'red'], ['cherry', 'red'],
  ['terracotta', 'rust'], ['orange', 'rust'], ['brick', 'rust'], ['copper', 'rust'], ['yellow', 'mustard'], ['gold', 'mustard'], ['ochre', 'mustard'],
  ['blush', 'pink'], ['rose', 'pink'], ['fuchsia', 'pink'], ['lilac', 'lavender'], ['purple', 'lavender'], ['violet', 'lavender'],
];
const byName = (n) => NAMED_COLORS.find((c) => c.name === n);
function colorIn(p, art) {
  const direct = NAMED_COLORS.slice().sort((a, b) => b.name.length - a.name.length).find((c) => new RegExp(`\\b${c.name}\\b`).test(p));
  if (direct) return direct;
  const syn = COLOR_WORDS.slice().sort((a, b) => b[0].length - a[0].length).find(([w]) => new RegExp(`\\b${w}\\b`).test(p));
  if (syn) return byName(syn[1]);
  if (art === 'jeans') return byName('denim blue');
  return null;
}

/** "black turtleneck, olive trousers, white sneakers" → [{label, category, art, color}] (keyword matching, no AI). */
export function decomposeLook(text) {
  const parts = text.toLowerCase().replace(/[.!?]/g, ',').split(/,|\+|\band\b|\bwith\b|;|\n|\//).map((s) => s.trim()).filter(Boolean);
  const items = [];
  for (const p of parts) {
    const noun = NOUNS_SORTED.find(([w]) => new RegExp(`\\b${w}`).test(p));
    if (!noun) continue;
    const color = colorIn(p, noun[2]);
    items.push({ label: p, category: noun[1], art: noun[2], color: color ? { name: color.name, hex: color.hex } : null });
  }
  return items;
}

// Garment types that can stand in for each other.
const FAMILY = { tee: 'casual-top', stripe: 'casual-top', knit: 'warm-top', turtleneck: 'warm-top', shirt: 'shirt', coat: 'long-layer', trench: 'long-layer', blazer: 'tailored', jacket: 'jacket', puffer: 'jacket', cardigan: 'warm-top', loafer: 'smart-shoe', boot: 'boot', sneaker: 'sneaker', sandal: 'open-shoe', tote: 'bag', crossbody: 'bag' };
const slotCat = (c) => (c === 'dress' ? 'dress' : c);

function colorScore(want, g) {
  if (!want.color) return 0.75; // the look didn't say a color
  let best = 0;
  for (const c of g.colors || []) {
    let cs;
    if (c.name === want.color.name) cs = 1;
    else if (isNeutral(c.name) && isNeutral(want.color.name)) cs = Math.abs(hexToHsl(c.hex)[2] - hexToHsl(want.color.hex)[2]) < 0.15 ? 0.7 : 0.35;
    else if (!isNeutral(c.name) && !isNeutral(want.color.name)) cs = hueDistance(hexToHsl(c.hex)[0], hexToHsl(want.color.hex)[0]) < 30 ? 0.65 : 0.15;
    else cs = 0.15;
    best = Math.max(best, cs);
  }
  return best;
}

/** How well one closet piece stands in for one wanted piece: { score, level: exact | close | approximate | null, why } */
export function similarity(want, g) {
  const sameCat = slotCat(g.category) === slotCat(want.category) || (want.art === 'cardigan' && g.art === 'cardigan');
  if (!sameCat) return { score: 0, level: null };
  const cs = colorScore(want, g);
  const shape = g.art === want.art ? 1 : FAMILY[g.art] && FAMILY[g.art] === FAMILY[want.art] ? 0.75 : 0.45;
  const score = 0.6 * cs + 0.4 * shape;
  const level = shape === 1 && cs >= 0.99 ? 'exact' : shape >= 0.75 && cs >= 0.65 ? 'close' : score >= 0.55 ? 'approximate' : null;
  const why = level === 'exact' ? 'Same type and color'
    : [shape < 1 ? `a ${g.art} instead of a ${want.art}` : '', cs < 0.99 && want.color ? `${g.colors?.[0]?.name || 'another color'} instead of ${want.color.name}` : ''].filter(Boolean).join(', ');
  return { score, level, why };
}

/**
 * Map a decomposed look onto the closet.
 * Each wanted piece becomes an exact / close / approximate match, or is missing (with the closest thing she owns, if any).
 * Coverage counts exact and close matches fully and approximate ones as half.
 */
export function matchLook(items, closet) {
  const used = new Set();
  const matches = [], missing = [];
  for (const want of items) {
    let best = null;
    for (const g of closet) {
      if (used.has(g.id)) continue;
      const s = similarity(want, g);
      if (s.level && (!best || s.score > best.s.score)) best = { g, s };
    }
    if (best) { used.add(best.g.id); matches.push({ want, garment: best.g, score: best.s.score, level: best.s.level, exact: best.s.level === 'exact', why: best.s.why }); }
    else {
      const nearest = closet.filter((g) => slotCat(g.category) === slotCat(want.category)).map((g) => ({ g, s: similarity(want, g) })).sort((a, b) => b.s.score - a.s.score)[0];
      missing.push({ ...want, reason: nearest ? `Nothing close enough. Nearest: ${nearest.g.name} (${nearest.s.why || 'different'})` : `No ${CATEGORY_WORD[slotCat(want.category)] || want.category} in this closet yet` });
    }
  }
  const points = matches.reduce((a, m) => a + (m.level === 'approximate' ? 0.5 : 1), 0);
  const coverage = items.length ? Math.round((points / items.length) * 100) : 0;
  return { coverage, matches, missing };
}
const CATEGORY_WORD = { top: 'tops', bottom: 'bottoms', dress: 'dresses', outer: 'outerwear', shoes: 'shoes', accessory: 'accessories of that kind' };

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
