// The Stylist Critic: a deterministic four-pillar rules engine.
// It produces scores + specific findings. In production, an LLM only rewrites these
// findings in a stylist's voice (it never adds new ones). See docs/ARCHITECTURE.md §4.2.

import { hexToHsl, hueDistance, isNeutral, temperature } from './color.js';

const NOUN = {
  tee: 'tee', turtleneck: 'turtleneck', shirt: 'shirt', stripe: 'striped tee', knit: 'sweater',
  trousers: 'trousers', jeans: 'jeans', shorts: 'shorts', skirt: 'skirt',
  trench: 'trench', blazer: 'blazer', coat: 'coat', puffer: 'down jacket', jacket: 'jacket', cardigan: 'cardigan',
  sneaker: 'sneakers', loafer: 'loafers', boot: 'boots', sandal: 'sandals',
  tote: 'tote', scarf: 'scarf', crossbody: 'crossbody bag', generic: 'piece',
};
const VOLUME = { fitted: -1, regular: 0, relaxed: 1, oversized: 2 };
const FORMALITY_LABEL = ['', 'Lounge', 'Casual', 'Smart casual', 'Business', 'Formal'];

/** Short, human label: "olive trousers" */
export function short(item) {
  if (!item) return '';
  const noun = NOUN[item.art] || item.category;
  return `${item.colors?.[0]?.name || ''} ${noun}`.trim();
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(v)));
const pieces = (o) => ['top', 'bottom', 'outer', 'shoes', 'accessory'].map((k) => o[k]).filter(Boolean);

// ───────────────────────────────── Pillar 1: Proportions & Silhouette
function proportions(o) {
  const pros = [], cons = [];
  let s = 74;
  const { top, bottom, outer, shoes } = o;
  if (!top || !bottom) {
    return { score: 50, pros, cons: ['Add both a top and a bottom so the silhouette can be judged.'] };
  }
  const tv = VOLUME[top.fit] ?? 0, bv = VOLUME[bottom.fit] ?? 0;

  if (tv >= 1 && bv >= 1) {
    if (tv + bv >= 3) { s -= 22; cons.push(`Volume on volume: the ${top.fit} ${short(top)} and ${bottom.fit} ${short(bottom)} swallow your frame. Tuck the top, or swap in a slimmer bottom.`); }
    else { s -= 8; cons.push(`Two relaxed pieces can read slouchy. A half-tuck of the ${short(top)} would define the waist.`); }
  } else if ((tv >= 1 && bv <= 0) || (bv >= 1 && tv <= 0)) {
    s += 14;
    const loose = tv >= 1 ? top : bottom, neat = tv >= 1 ? bottom : top;
    pros.push(`Balanced proportions: ${loose.fit} ${short(loose)} against ${neat.fit === 'fitted' ? 'a fitted' : 'a ' + neat.fit} ${short(neat)}.`);
  } else if (tv < 0 && bv < 0) {
    s += 4;
    pros.push('Streamlined, close-to-body line from top to hem.');
    if (!outer) cons.push('All-fitted can feel a little severe. A relaxed outer layer would add ease.');
  } else {
    s += 6;
    pros.push('Classic regular-fit proportions that are easy to wear and well balanced.');
  }

  if (outer) {
    if (outer.length === 'long' && bottom.art === 'shorts') { s -= 12; cons.push(`A long ${short(outer)} over shorts cuts the leg at an awkward point.`); }
    else if (outer.length === 'long' && bv >= 1) { s += 6; pros.push(`The long ${short(outer)} over wide ${short(bottom)} makes one long, elegant column.`); }
    else if (outer.length === 'cropped' && tv >= 2) { s -= 8; cons.push(`The cropped ${short(outer)} lets the oversized ${short(top)} hang out unevenly below it.`); }
    else if (outer.length === 'cropped' && bv >= 1) { s += 6; pros.push(`A cropped ${short(outer)} over wide ${short(bottom)} lengthens the leg line.`); }
  }

  if (shoes) {
    if (shoes.profile === 'chunky' && bv >= 1) { s += 4; pros.push(`The substantial ${short(shoes)} anchor the wide trouser leg.`); }
    else if (shoes.profile === 'sleek' && bv < 0) { s += 4; pros.push(`Sleek ${short(shoes)} continue the slim line of the ${short(bottom)}.`); }
    else if (shoes.profile === 'chunky' && bottom.art === 'skirt') { pros.push(`Chunky ${short(shoes)} under a midi skirt is a modern, grounded contrast.`); }
  }
  return { score: clamp(s), pros, cons };
}

// ───────────────────────────────── Pillar 2: Fabric & Weather Practicality
export function warmthOf(o) {
  return (o.top?.warmth || 0) + (o.outer?.warmth || 0) + 0.5 * (o.bottom?.warmth || 0) + 0.3 * (o.shoes?.warmth || 0) + (o.accessory?.warmth || 0);
}
export function warmthNeeded(tempC) {
  return Math.max(1.5, Math.min(12, 3 + (22 - tempC) / 2.5));
}

function fabricWeather(o, ctx) {
  const pros = [], cons = [];
  let s = 78;
  const t = ctx.tempC;
  const have = warmthOf(o), need = warmthNeeded(t);
  const diff = have - need;

  if (diff < -2.5) { s -= 28; cons.push(`Underdressed for ${t}°C. This look is about ${Math.round(have)} warmth points against roughly ${Math.round(need)} needed. Add a layer${o.outer ? ' or a heavier knit' : ', like a coat or a knit'}.`); }
  else if (diff < -1.2) { s -= 12; cons.push(`Slightly light for ${t}°C. You may feel the chill once the sun goes.`); }
  else if (diff > 3) { s -= 22; cons.push(`Overheated at ${t}°C: ${o.outer ? `the ${short(o.outer)} is too much layering` : 'this is too much fabric'} for the conditions.`); }
  else if (diff > 1.5) { s -= 6; cons.push(`May run warm indoors at ${t}°C. Choose a layer that's easy to take off.`); }
  else { s += 10; pros.push(`Warmth is well judged for ${t}°C.`); }

  if (ctx.rain >= 0.6) {
    const sh = o.shoes;
    if (sh && sh.water <= 1) { s -= 18; cons.push(`Wearing ${sh.material.toLowerCase()} ${NOUN[sh.art] || 'shoes'} in the rain is risky, because water marks and stains them. Choose leather boots or rubber soles.`); }
    else if (sh && sh.art === 'sandal') { s -= 18; cons.push('Open sandals in the rain mean wet feet. Choose closed shoes.'); }
    else if (sh && sh.water >= 4) { s += 8; pros.push(`The ${short(sh)} (${sh.material.toLowerCase()}) will shrug off puddles.`); }
    if (o.outer && o.outer.water >= 4) { s += 10; pros.push(`The water-repellent ${short(o.outer)} handles the drizzle.`); }
    else if (!o.outer) { s -= 12; cons.push('There\'s no rain-ready layer. A trench or mac would keep the look intact.'); }
    else { s -= 6; cons.push(`The ${short(o.outer)} isn't water-resistant, so you'll want an umbrella.`); }
  }

  if (o.shoes?.art === 'sandal' && t < 18) { s -= 18; cons.push(`Sandals at ${t}°C will leave your feet cold. Closed shoes are the move.`); }

  const items = pieces(o);
  if (t >= 27) {
    const heavy = items.find((i) => i.weight === 'heavy');
    if (heavy) { s -= 10; cons.push(`The heavy ${short(heavy)} will trap heat.`); }
    const linen = items.find((i) => /linen/i.test(i.material || ''));
    if (linen) { s += 6; pros.push(`Breathable linen in the ${short(linen)} is exactly right for the heat.`); }
  }

  const light = items.find((i) => /linen/i.test(i.material || '') && i.category !== 'accessory');
  const heavyClash = items.find((i) => i.weight === 'heavy' && i.category !== 'shoes');
  if (light && heavyClash) { s -= 8; cons.push(`Fabric weight clash: airy ${short(light)} next to a heavy ${short(heavyClash)} reads seasonally confused.`); }

  const offSeason = items.filter((i) => i.seasons && !i.seasons.includes(ctx.season) && i.category !== 'accessory').slice(0, 2);
  for (const i of offSeason) { s -= 6; cons.push(`The ${short(i)} is meant for ${i.seasons.join('/')}, so it looks out of place in ${ctx.season}.`); }

  return { score: clamp(s), pros, cons };
}

// ───────────────────────────────── Pillar 3: Color Harmony
function colorHarmony(o) {
  const pros = [], cons = [];
  const items = pieces(o);
  if (!items.length) return { score: 0, pros, cons: ['Add pieces to see color feedback.'] };

  const accents = [];
  for (const it of items) for (const c of it.colors || []) if (!isNeutral(c.name)) accents.push({ ...c, item: it });
  const uniqueAccents = [...new Map(accents.map((a) => [a.name, a])).values()];
  let s;

  if (uniqueAccents.length === 0) {
    const ls = items.map((i) => hexToHsl(i.colors[0].hex)[2]);
    if (ls.every((l) => l < 0.3)) { s = 86; pros.push('A tonal dark palette that reads sleek and intentional.'); }
    else if (ls.every((l) => l > 0.75)) { s = 86; pros.push('A fresh, light tonal palette that works well in daylight.'); }
    else { s = 84; pros.push('An all-neutral palette: calm, versatile, and almost impossible to clash.'); }
    if (items.length >= 4 && !o.accessory) { s -= 3; cons.push('This is a safe palette. One colored accessory would give it a point of interest.'); }
  } else if (uniqueAccents.length === 1) {
    const a = uniqueAccents[0];
    s = 92; pros.push(`${cap(a.name)} is your one focal point (the ${NOUN[a.item.art] || 'piece'}), set against neutrals. Textbook.`);
  } else if (uniqueAccents.length === 2) {
    const [a, b] = uniqueAccents;
    const hd = hueDistance(hexToHsl(a.hex)[0], hexToHsl(b.hex)[0]);
    if (hd < 40) { s = 86; pros.push(`${cap(a.name)} and ${b.name} are analogous hues, so they harmonize quietly.`); }
    else if (hd >= 150) { s = 80; pros.push(`${cap(a.name)} with ${b.name} is a complementary pairing: bold but controlled.`); }
    else {
      s = 62;
      const warmCool = temperature(a.hex) !== temperature(b.hex) ? ' (one warm, one cool)' : '';
      cons.push(`${cap(a.name)} and ${b.name} compete for attention${warmCool}. Keep one and swap the other for a neutral.`);
    }
  } else {
    s = 50; cons.push(`Too many focal colors (${uniqueAccents.map((a) => a.name).join(', ')}). Let one lead.`);
  }

  // Classic near-miss: black right next to navy as separate pieces.
  const names = items.map((i) => i.colors[0].name);
  if (names.includes('black') && names.includes('navy')) {
    s -= 6; cons.push('Black right next to navy can read as a near-miss. Make the contrast obviously intentional, or pick one.');
  }
  return { score: clamp(s), pros, cons };
}

// ───────────────────────────────── Pillar 4: Occasion Fit
function occasionFit(o, ctx) {
  const pros = [], cons = [];
  const core = ['top', 'bottom', 'outer', 'shoes'].map((k) => o[k]).filter(Boolean);
  if (!core.length) return { score: 0, pros, cons: ['Add pieces to judge the occasion fit.'] };
  const f = core.map((i) => i.formality);
  const avg = f.reduce((a, b) => a + b, 0) / f.length;
  const diff = avg - ctx.formality;
  let s;
  const low = core.reduce((a, b) => (b.formality < a.formality ? b : a));
  const high = core.reduce((a, b) => (b.formality > a.formality ? b : a));

  if (Math.abs(diff) <= 0.6) { s = 90; pros.push(`The formality sits right for ${ctx.occasionLabel.toLowerCase()}.`); }
  else if (diff < 0) { s = clamp(90 - 26 * Math.abs(diff)); cons.push(`Too casual for ${ctx.occasionLabel.toLowerCase()}. The ${short(low)} pulls the look down.`); }
  else if (diff <= 1.25) { s = 82; pros.push(`A touch polished for ${ctx.occasionLabel.toLowerCase()}, which reads intentional rather than overdone.`); }
  else { s = clamp(92 - 20 * diff); cons.push(`Overdressed for ${ctx.occasionLabel.toLowerCase()}. Relax it by swapping the ${short(high)}.`); }

  if (high.formality - low.formality >= 3) {
    if (low.category === 'shoes' && low.art === 'sneaker') { s += 4; pros.push(`High-low mix: ${short(low)} with the ${short(high)} is a deliberate, modern touch.`); }
    else { s -= 10; cons.push(`Formality gap: the ${short(low)} and ${short(high)} come from different worlds.`); }
  }
  if (!o.shoes) { s -= 10; cons.push('Add shoes to complete the look.'); }
  return { score: clamp(s), pros, cons, avg };
}

// ───────────────────────────────── Public API
export const PILLARS = [
  { id: 'proportions', label: 'Proportions & Silhouette', weight: 0.23 },
  { id: 'fabric', label: 'Fabric & Weather', weight: 0.31 },
  { id: 'color', label: 'Color Harmony', weight: 0.23 },
  { id: 'occasion', label: 'Occasion Fit', weight: 0.23 },
];

export function critique(outfit, ctx) {
  const results = {
    proportions: proportions(outfit),
    fabric: fabricWeather(outfit, ctx),
    color: colorHarmony(outfit),
    occasion: occasionFit(outfit, ctx),
  };
  const overall = clamp(PILLARS.reduce((sum, p) => sum + results[p.id].score * p.weight, 0));
  const items = pieces(outfit);
  const seasons = ['spring', 'summer', 'autumn', 'winter'].filter((s) => items.filter((i) => i.category !== 'accessory').every((i) => !i.seasons || i.seasons.includes(s)));
  const avgF = results.occasion.avg || 0;

  return {
    overall,
    pillars: PILLARS.map((p) => ({ ...p, ...results[p.id] })),
    seasons,
    weatherMeter: Math.max(1, Math.min(5, Math.round(results.fabric.score / 20))),
    formalityMeter: Math.max(1, Math.min(5, Math.round(avgF))),
    formalityLabel: FORMALITY_LABEL[Math.max(1, Math.min(5, Math.round(avgF)))] || '—',
    warmth: { have: Math.round(warmthOf(outfit) * 10) / 10, need: Math.round(warmthNeeded(ctx.tempC) * 10) / 10 },
  };
}

/** Find the single swap (or added layer) that improves the overall score most. */
export function suggestSwap(outfit, ctx, pool) {
  const base = critique(outfit, ctx).overall;
  let best = null;
  for (const slot of ['top', 'bottom', 'outer', 'shoes']) {
    const candidates = pool.filter((g) => g.category === slot && g.id !== outfit[slot]?.id);
    for (const c of candidates) {
      const score = critique({ ...outfit, [slot]: c }, ctx).overall - (c.placeholder ? 3 : 0);
      if (!best || score > best.score) best = { slot, to: c, from: outfit[slot] || null, score };
    }
    if (slot === 'outer' && outfit.outer) {
      const score = critique({ ...outfit, outer: null }, ctx).overall;
      if (!best || score > best.score) best = { slot, to: null, from: outfit.outer, score };
    }
  }
  if (!best || best.score - base < 3) return null;
  const gain = best.score - base;
  let text;
  if (!best.to) text = `Drop the ${short(best.from)}. You don't need the layer today.`;
  else if (!best.from) text = `Add the ${short(best.to)}${best.to.placeholder ? ' (a basic you don\'t own yet)' : ''}.`;
  else text = `Swap the ${short(best.from)} for the ${short(best.to)}${best.to.placeholder ? ' (basic)' : ''}.`;
  return { ...best, gain, text };
}
