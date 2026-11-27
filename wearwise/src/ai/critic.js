// The Stylist Critic: a deterministic rules engine (no AI) covering the brief's eight quality checks:
// color harmony, proportion, occasion, weather, style consistency, footwear, accessories, comfort.
// It produces scores + specific findings. The AI stylist (Gemini) may add taste on top, but is
// told not to contradict these facts. See docs/ARCHITECTURE.md §4.2.

import { hexToHsl, hueDistance, isNeutral, temperature } from './color.js';
import { slotOf } from '../data/closet.js';

const NOUN = {
  tee: 'tee', turtleneck: 'turtleneck', shirt: 'shirt', stripe: 'striped tee', knit: 'sweater',
  trousers: 'trousers', jeans: 'jeans', shorts: 'shorts', skirt: 'skirt',
  trench: 'trench', blazer: 'blazer', coat: 'coat', puffer: 'down jacket', jacket: 'jacket', cardigan: 'cardigan',
  sneaker: 'sneakers', loafer: 'loafers', boot: 'boots', sandal: 'sandals',
  tote: 'tote', scarf: 'scarf', crossbody: 'crossbody bag', hat: 'hat', necklace: 'necklace', belt: 'belt',
  dress: 'dress', generic: 'piece',
};
const VOLUME = { fitted: -1, regular: 0, relaxed: 1, oversized: 2 };
const FORMALITY_LABEL = ['', 'Lounge', 'Casual', 'Smart casual', 'Business', 'Formal'];

/** Short, human label: "olive trousers" */
export function short(item) {
  if (!item) return '';
  const noun = NOUN[item.art] || item.category;
  let color = item.colors?.[0]?.name || '';
  if (item.art === 'jeans' && /denim/.test(color)) color = 'blue';
  return `${color} ${noun}`.trim();
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const PLURAL = new Set(['trousers', 'jeans', 'shorts', 'sneaker', 'loafer', 'boot', 'sandal']);
const plural = (i) => PLURAL.has(i?.art);
const isAre = (items) => (items.length > 1 || plural(items[0]) ? 'are' : 'is');
/** "a date", "church", "work" … */
export const occ = (ctx) => {
  const l = (ctx.occasionLabel || 'today').toLowerCase();
  return ['date', 'party', 'wedding', 'special occasion', 'interview'].includes(l) ? `${aAn(l)} ${l}` : l;
};
const aAn = (w) => (/^[aeiou]/i.test(w) ? 'an' : 'a');
const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(v)));
const pieces = (o) => ['top', 'bottom', 'outer', 'shoes', 'bag', 'accessory'].map((k) => o[k]).filter(Boolean);
export const isDress = (item) => item?.category === 'dress';
/** True when the outfit has the essentials: (top + bottom) or a dress, plus shoes. */
export const isComplete = (o) => !!(o.top && (o.bottom || isDress(o.top)) && o.shoes);

// ───────────────────────────────── Pillar 1: Proportions & Silhouette
function proportions(o) {
  const pros = [], cons = [];
  let s = 74;
  const { top, bottom, outer, shoes } = o;
  if (isDress(top)) {
    s = 82;
    pros.push(`The ${short(top)} gives one clean, unbroken line.`);
    if (outer?.length === 'long') { s += 4; pros.push(`A long ${short(outer)} over the dress keeps the long, elegant line.`); }
    if (outer?.length === 'cropped') { s += 3; pros.push(`A cropped ${short(outer)} marks the waist over the dress.`); }
    if (shoes?.profile === 'chunky' && top.formality >= 4) { s -= 6; cons.push(`Chunky ${short(shoes)} feel heavy under a dressy ${short(top)}. Sleeker shoes would suit it better.`); }
    return { score: clamp(s), pros, cons };
  }
  if (!top || !bottom) {
    return { score: 50, pros, cons: ['Add both a top and a bottom (or a dress) so the silhouette can be judged.'] };
  }
  const tv = VOLUME[top.fit] ?? 0, bv = VOLUME[bottom.fit] ?? 0;

  if (tv >= 1 && bv >= 1) {
    if (tv + bv >= 3) { s -= 22; cons.push(`Volume on volume: the ${top.fit} ${short(top)} and ${bottom.fit} ${short(bottom)} swallow your frame. Tuck the top, or swap in a slimmer bottom.`); }
    else { s -= 8; cons.push(`Two relaxed pieces can read slouchy. A half-tuck of the ${short(top)} would define the waist.`); }
  } else if ((tv >= 1 && bv <= 0) || (bv >= 1 && tv <= 0)) {
    s += 14;
    const loose = tv >= 1 ? top : bottom, neat = tv >= 1 ? bottom : top;
    pros.push(`The ${loose.fit} ${short(loose)} ${plural(loose) ? 'are' : 'is'} balanced by the ${neat.fit === 'fitted' ? 'slimmer' : 'neater'} ${short(neat)}.`);
  } else if (tv < 0 && bv < 0) {
    s += 4;
    pros.push('Streamlined, close-to-body line from top to hem.');
    if (!outer) cons.push('All-fitted can feel a little severe. A relaxed outer layer would add ease.');
  } else {
    s += 6;
    pros.push('Easy, classic proportions that flatter without trying too hard.');
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
  return (o.top?.warmth || 0) + (isDress(o.top) ? 0.5 * (o.top?.warmth || 0) : 0) + (o.outer?.warmth || 0) + 0.5 * (o.bottom?.warmth || 0) + 0.3 * (o.shoes?.warmth || 0) + (o.accessory?.warmth || 0);
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
  else { s += 10; pros.push(`Just the right warmth for ${t}°C.`); }

  if (ctx.rain >= 0.6) {
    const sh = o.shoes;
    if (sh && sh.water <= 1) { s -= 18; cons.push(`Wearing ${(sh.material || 'these').toLowerCase()} ${NOUN[sh.art] || 'shoes'} in the rain is risky, because water marks and stains them. Choose leather boots or rubber soles.`); }
    else if (sh && sh.art === 'sandal') { s -= 18; cons.push('Open sandals in the rain mean wet feet. Choose closed shoes.'); }
    else if (sh && sh.water >= 4) { s += 8; pros.push(`The ${short(sh)}${sh.material ? ` (${sh.material.toLowerCase()})` : ''} will shrug off puddles.`); }
    if (o.outer && o.outer.water >= 4) { s += 10; pros.push(`The water-repellent ${short(o.outer)} handles the drizzle.`); }
    else if (!o.outer) { s -= 12; cons.push('There\'s no rain-ready layer. A trench or mac would keep the look intact.'); }
    else { s -= 6; cons.push(`The ${short(o.outer)} isn't water-resistant, so you'll want an umbrella.`); }
  }

  if (o.shoes?.art === 'sandal' && t < 18) { s -= 18; cons.push(`Sandals at ${t}°C will leave your feet cold. Closed shoes are the move.`); }

  const items = pieces(o);
  if (t >= 27 && o.shoes?.art === 'boot') { s -= 10; cons.push(`The ${short(o.shoes)} will be hot at ${t}°C.`); }
  if (t >= 27 && o.top && (o.top.warmth || 0) >= 3) { s -= 15; cons.push(`The ${short(o.top)} is too warm a top for ${t}°C. Choose something light and breathable.`); }
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

  // Comfort & practicality (weighted more when she asked for comfort, or it's sports/vacation)
  const wantsComfort = ctx.prefs?.includes('comfortable') || ['sports', 'vacation'].includes(ctx.occasion);
  const stiff = items.filter((i) => comfortOf(i) <= 1);
  const easy = items.filter((i) => comfortOf(i) >= 3 && i.category !== 'accessory');
  if (wantsComfort) {
    if (stiff.length) { s -= 8 * stiff.length; cons.push(`For comfort, the ${stiff.map(short).join(' and ')} ${isAre(stiff)} on the stiff side.`); }
    else if (easy.length >= 2) { s += 6; pros.push(`Comfortable all day: the ${easy.slice(0, 2).map(short).join(' and ')} move with you.`); }
  }
  if (ctx.occasion === 'sports' && o.shoes && o.shoes.art !== 'sneaker') { s -= 14; cons.push(`You'll want sneakers for sports, not ${short(o.shoes)}.`); }
  return { score: clamp(s), pros, cons };
}

// ───────────────────────────────── Pillar 3: Color Harmony
function colorHarmony(o, ctx = {}) {
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
    s = 92; pros.push(`The ${short(a.item)} ${plural(a.item) ? 'are' : 'is'} the one pop of color against calm neutrals.`);
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

  // Pattern compatibility: one pattern leads; two need a shared color and different scale
  const patterned = items.filter((i) => i.pattern && i.pattern !== 'solid');
  if (patterned.length >= 2) {
    const shareColor = patterned[0].colors.some((c) => patterned[1].colors.some((d) => d.name === c.name));
    if (patterned[0].pattern === patterned[1].pattern) { s -= 14; cons.push(`Two ${patterned[0].pattern} patterns (${short(patterned[0])} and ${short(patterned[1])}) fight each other. Keep one and go plain with the other.`); }
    else if (shareColor) { s -= 2; pros.push(`Brave pattern mix, held together by a shared color.`); }
    else { s -= 10; cons.push(`The ${patterned[0].pattern} ${short(patterned[0])} and ${patterned[1].pattern} ${short(patterned[1])} don't share a color, so they clash.`); }
  } else if (patterned.length === 1) {
    pros.push(`The ${patterned[0].pattern} ${short(patterned[0])} leads; the plain pieces let it breathe.`);
  }

  // Her preference: simple vs colorful / stand out
  const prefs = ctx.prefs || [];
  if (prefs.includes('simple')) {
    if (uniqueAccents.length + patterned.length >= 2) { s -= 10; cons.push('You asked for simple: there\'s a lot going on in color and pattern here.'); }
    else { s += 4; pros.push('Clean and simple, as you asked.'); }
  }
  if (prefs.includes('colorful') || prefs.includes('standout')) {
    if (uniqueAccents.length === 0 && patterned.length === 0) { s -= 12; cons.push(prefs.includes('colorful') ? 'You wanted more color, but this look is all neutrals.' : 'You wanted to stand out, but this look plays it very safe.'); }
    else { s += 6; pros.push(prefs.includes('colorful') ? 'Brings in the color you asked for.' : 'Has the eye-catching point you asked for.'); }
  }

  // Flat contrast: two different, non-neutral colors at the same depth meeting at the waist look muddy.
  const tp = isDress(o.top) ? null : o.top, bt = isDress(o.top) ? null : o.bottom;
  if (tp && bt && tp.colors?.[0] && bt.colors?.[0] && !isNeutral(tp.colors[0].name) && !isNeutral(bt.colors[0].name) && tp.colors[0].name !== bt.colors[0].name) {
    const [h1, , l1] = hexToHsl(tp.colors[0].hex), [h2, , l2] = hexToHsl(bt.colors[0].hex);
    const dh = Math.min(Math.abs(h1 - h2), 360 - Math.abs(h1 - h2));
    if (Math.abs(l1 - l2) < 0.08 && dh > 40) { s -= 6; cons.push(`The ${short(tp)} and ${short(bt)} are the same depth of color, so they compete. A lighter or darker partner for one of them would look sharper.`); }
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

  if (Math.abs(diff) <= 0.6) { s = 90; pros.push(`The formality sits right for ${occ(ctx)}.`); }
  else if (diff < 0) { s = clamp(90 - 26 * Math.abs(diff)); cons.push(`Too casual for ${occ(ctx)}. The ${short(low)} ${plural(low) ? 'pull' : 'pulls'} the look down.`); }
  else if (diff <= 1.25) { s = 82; pros.push(`A touch polished for ${occ(ctx)}, which reads intentional rather than overdone.`); }
  else { s = clamp(92 - 20 * diff); cons.push(`Overdressed for ${occ(ctx)}. Relax it by swapping the ${short(high)}.`); }

  if (high.formality - low.formality >= 3) {
    if (low.category === 'shoes' && low.art === 'sneaker' && low.profile !== 'chunky' && !['sporty', 'streetwear'].includes(low.style)) { s += 4; pros.push(`High-low mix: ${short(low)} with the ${short(high)} is a deliberate, modern touch.`); }
    else { s -= 10; cons.push(`Formality gap: the ${short(low)} and ${short(high)} come from different worlds.`); }
  }
  if (o.shoes && ctx.formality >= 3.5 && (o.shoes.formality || 2) <= ctx.formality - 1.5 && o.shoes.art !== 'sneaker') { s -= 14; cons.push(`The ${short(o.shoes)} ${plural(o.shoes) ? 'are' : 'is'} too casual for ${occ(ctx)}.`); }
  if (!o.shoes) { s -= 10; cons.push('Add shoes to complete the look.'); }
  if (o.top && !isDress(o.top) && !o.bottom) { s -= 15; cons.push('Add a bottom (or choose a dress) to complete the look.'); }
  s += occasionCharacter(o, ctx, pros, cons);
  return { score: clamp(s), pros, cons, avg };
}

// ─── Occasion character: occasions differ in mood, not only in how dressy they are. Small, explained effects.
const known = (i, field) => i && i[field] != null && !(i.unverified || []).includes(field);
const LUXE = /silk|satin|velvet|sequin|lace|chiffon|organza|leather/;
function occasionCharacter(o, ctx, pros, cons) {
  const core = ['top', 'bottom', 'outer', 'shoes'].map((k) => o[k]).filter(Boolean);
  const all = pieces(o);
  if (!core.length) return 0;
  const styleOf = (i) => (known(i, 'style') ? i.style : null);
  const has = (re, list = core) => list.find((i) => re.test(`${i.art || ''} ${i.name || ''}`.toLowerCase()));
  const sporty = core.find((i) => ['sporty', 'streetwear'].includes(styleOf(i)));
  const edgy = core.find((i) => styleOf(i) === 'edgy');
  const shorts = has(/shorts/);
  const denim = core.find((i) => known(i, 'material') && /denim/.test(i.material.toLowerCase()) || /jeans/.test((i.art || '') + (i.name || '').toLowerCase()));
  const sleeveless = o.top && o.top.sleeve === 'sleeveless' && !o.outer ? o.top : null;
  const color = (i) => i.colors?.[0]?.name;
  // A real standout (dress, shine, strong color) vs. a small one (a pattern, a statement accessory)
  const bold = (i) => color(i) && !isNeutral(color(i)) && !['navy', 'denim', 'olive', 'khaki', 'camel', 'brown', 'beige', 'cream'].includes(color(i));
  const standout = all.find((i) => i.category !== 'shoes' && i.category !== 'accessory' && i.category !== 'bag'
    && (isDress(i) || bold(i) || (known(i, 'material') && LUXE.test(i.material.toLowerCase()) && !/leather/.test(i.material.toLowerCase()))));
  const touch = !standout && all.find((i) => (i.pattern && !['solid', 'plain'].includes(i.pattern) && i.category !== 'shoes') || (i.category === 'accessory' && (i.formality || 2) >= 3.5) || (i.category !== 'shoes' && known(i, 'material') && /leather/.test(i.material.toLowerCase())));
  const officey = core.filter((i) => styleOf(i) === 'business').length >= 2;
  let d = 0;
  // Pieces she (or the AI) tagged for this occasion count a little.
  const tagged = core.filter((i) => known(i, 'occasions') && i.occasions?.length);
  if (tagged.length >= 2) {
    const share = tagged.filter((i) => i.occasions.includes(ctx.occasion)).length / tagged.length;
    d += Math.round((share - 0.5) * 8); // −4 … +4
  }
  switch (ctx.occasion) {
    case 'work':
      if (shorts) { d -= 10; cons.push(`${cap(short(shorts))} read too off-duty for work.`); }
      else if (sporty || edgy) { d -= 8; cons.push(`The ${short(sporty || edgy)} ${plural(sporty || edgy) ? 'feel' : 'feels'} too street for most workplaces.`); }
      else if (denim && ctx.formality >= 3.5) { d -= 3; cons.push(`${cap(short(denim))} suit smart-casual offices; elsewhere, trousers are safer.`); }
      else if (core.filter((i) => ['business', 'classic', 'preppy', 'minimalist'].includes(styleOf(i))).length >= 2) { d += 4; pros.push('Polished and easy to wear all day: right for work.'); }
      break;
    case 'party':
      if (standout) {
        const shiny = known(standout, 'material') && LUXE.test(standout.material.toLowerCase());
        const strong = (isDress(standout) ? 1 : 0) + (shiny ? 1 : 0) + (bold(standout) ? 1 : 0); // dress, shine, color
        d += strong >= 2 ? 10 : 6;
        pros.push(strong >= 2 ? `The ${shiny ? standout.material.toLowerCase() + ' ' : ''}${short(standout)} is made for a party.` : `The ${short(standout)} ${plural(standout) ? 'bring' : 'brings'} the party feel.`);
      }
      else if (touch) { d += 1; pros.push(`The ${short(touch)} ${plural(touch) ? 'add' : 'adds'} a little interest; a stronger color or some shine would make it feel more like a party.`); }
      else { d -= 5; cons.push('All calm neutrals: it reads more office than party. One standout piece (color, shine or a dress) would lift it.'); }
      if (officey) { d -= 3; cons.push('Two business pieces together look like work clothes.'); }
      break;
    case 'date':
      if (sporty) { d -= 8; cons.push(`The ${short(sporty)} ${plural(sporty) ? 'are' : 'is'} too sporty for a date.`); }
      else if (officey) { d -= 5; cons.push('Two business pieces together feel like you came straight from the office.'); }
      else if (core.some((i) => ['elegant', 'feminine'].includes(styleOf(i))) || standout) { d += 4; pros.push('Polished but relaxed, with a little something special: good for a date.'); }
      break;
    case 'church':
      if (shorts || sleeveless) { d -= 8; cons.push(`${cap(short(shorts || sleeveless))} may feel too bare for church; add a layer or choose longer pieces.`); }
      else if (edgy || sporty) { d -= 6; cons.push(`The ${short(edgy || sporty)} ${plural(edgy || sporty) ? 'feel' : 'feels'} too loud for church.`); }
      else if (core.some((i) => ['classic', 'feminine', 'preppy', 'elegant'].includes(styleOf(i)))) { d += 3; pros.push('Neat and calm: right for church.'); }
      break;
    case 'wedding': case 'special':
      if (denim) { d -= 10; cons.push(`${cap(short(denim))} are too casual for ${occ(ctx)}.`); }
      if (sporty) { d -= 10; cons.push(`The ${short(sporty)} ${plural(sporty) ? 'don\'t' : 'doesn\'t'} belong at ${occ(ctx)}.`); }
      break;
    case 'vacation':
      if (core.some((i) => known(i, 'material') && /linen|cotton/.test(i.material.toLowerCase())) && !officey) { d += 3; pros.push('Easy, breathable pieces: made for a holiday.'); }
      if (officey) { d -= 5; cons.push('Two business pieces feel like work, not a holiday.'); }
      break;
    default:
  }
  return d;
}

// ───────────────────────────────── Comfort helper (0 stiff … 4 very comfortable)
export function comfortOf(i) {
  if (!i) return 2;
  const m = (i.material || '').toLowerCase();
  let c = 2;
  if (/jersey|knit|fleece|stretch|linen|cotton|modal|down/.test(m)) c += 1;
  if (/satin|patent|gabardine|cashmere/.test(m)) c -= 1;
  if (i.fit === 'relaxed' || i.fit === 'oversized') c += 1;
  if (i.fit === 'fitted' && /denim/.test(m)) c -= 1;
  if (i.art === 'sneaker' || i.art === 'sandal') c += 1;
  if (i.art === 'loafer' && i.formality >= 4) c -= 1;
  return Math.max(0, Math.min(4, c));
}

// ───────────────────────────────── Pillar 5: Style, Shoes, Accessories & Balance
// Style families: pieces within a family (or neighbouring families) look like they belong together.
const STYLE_FAMILY = {
  casual: 'easy', minimalist: 'clean', classic: 'clean', preppy: 'clean', business: 'polished', elegant: 'polished',
  feminine: 'soft', sporty: 'sport', streetwear: 'street', edgy: 'street',
};
const CLASHES = [['sport', 'polished'], ['street', 'polished'], ['sport', 'soft'], ['street', 'soft']];
const styleName = (x) => (x === 'business' ? 'business-casual' : x);
function finish(o, ctx) {
  const pros = [], cons = [];
  let s = 80;
  const core = ['top', 'bottom', 'outer', 'shoes'].map((k) => o[k]).filter(Boolean);
  const styled = core.filter((i) => i.style);
  const fams = [...new Set(styled.map((i) => STYLE_FAMILY[i.style]).filter(Boolean))];
  const clash = CLASHES.find(([a, b]) => fams.includes(a) && fams.includes(b));
  if (clash) {
    const A = styled.find((i) => STYLE_FAMILY[i.style] === clash[0]), B = styled.find((i) => STYLE_FAMILY[i.style] === clash[1]);
    s -= 22; cons.push(`Mixed messages: the ${styleName(A.style)} ${short(A)} and the ${styleName(B.style)} ${short(B)} pull in different directions.`);
  } else if (styled.length >= 3 && fams.length <= 2) {
    s += 8; { const mood = [...new Set(styled.map((i) => styleName(i.style)))].slice(0, 2).join(' / '); pros.push(`Every piece speaks the same ${mood.replace(' / ', '-and-')} language.`); }
  }
  if (ctx.style && styled.length) {
    const match = styled.filter((i) => i.style === ctx.style || STYLE_FAMILY[i.style] === STYLE_FAMILY[ctx.style]).length / styled.length;
    if (match >= 0.6) { s += 6; pros.push(`Fits the ${styleName(ctx.style)} style you picked.`); }
    else if (match < 0.3) { s -= 10; cons.push(`Not very ${styleName(ctx.style)}: most pieces lean another way.`); }
  }

  // Footwear: do the shoes suit the rest?
  const sh = o.shoes;
  if (sh) {
    const rest = core.filter((i) => i !== sh);
    const avg = rest.length ? rest.reduce((a, i) => a + i.formality, 0) / rest.length : sh.formality;
    const be = plural(sh) ? 'are' : 'is';
    if (sh.formality - avg >= 2) { s -= 10; cons.push(`The ${short(sh)} ${be} dressier than the rest of the outfit.`); }
    else if (avg - sh.formality >= 2 && sh.art !== 'sneaker') { s -= 10; cons.push(`The ${short(sh)} ${be} too casual for the rest of the outfit.`); }
    else if (avg - sh.formality >= 2 && sh.art === 'sneaker' && (ctx.formality >= 4 || ctx.style === 'elegant')) { s -= 10; cons.push(`The ${short(sh)} are too casual for an ${ctx.style === 'elegant' ? 'elegant' : 'dressy'} look.`); }
    else if (avg - sh.formality >= 2 && sh.art === 'sneaker' && (sh.profile === 'chunky' || ['sporty', 'streetwear'].includes(sh.style))) { s -= 8; cons.push(`The ${short(sh)} ${be} too sporty for the rest of the outfit.`); }
    else if (avg - sh.formality >= 2 && sh.art === 'sneaker') { pros.push(`The ${short(sh)} relax a smart outfit, a modern touch.`); }
    else { s += 4; const tone = avg >= 3.3 ? 'keep it polished' : avg <= 1.8 ? 'keep it easy-going' : 'pull it together'; pros.push(`The ${short(sh)} ${tone}.`); }
    if (sh.art === 'sandal' && o.outer?.weight === 'heavy') { s -= 10; cons.push(`Sandals with a heavy ${short(o.outer)} mix two seasons.`); }
  }

  // Accessories: add, don't clutter
  const extras = [o.bag, o.accessory].filter(Boolean);
  const loud = extras.filter((i) => !isNeutral(i.colors[0].name));
  const before = cons.length;
  if (loud.length >= 2) { s -= 8; cons.push(`Two bold accessories (${loud.map(short).join(', ')}) compete. Keep one.`); }
  if (o.bag && (/straw|woven|raffia|wicker/i.test(`${o.bag.name} ${o.bag.material || ''}`) && ctx.tempC < 15 || /straw|woven|raffia|wicker|canvas/i.test(`${o.bag.name} ${o.bag.material || ''}`) && ctx.rain >= 0.6)) { s -= 8; cons.push(ctx.rain >= 0.6 ? `A ${short(o.bag)} will soak up the rain.` : `A ${short(o.bag)} is a summer piece; it looks out of season at ${ctx.tempC}°C.`); }
  if (o.accessory?.art === 'scarf' && ctx.tempC >= 25) { s -= 10; cons.push(`A ${short(o.accessory)} is too warm for ${ctx.tempC}°C.`); }
  if (o.accessory?.art === 'necklace' && core.some((i) => i.style === 'sporty')) { s -= 6; cons.push(`The ${short(o.accessory)} feels out of place with sporty pieces.`); }
  const coreAvg = core.length ? core.reduce((a, i) => a + (i.formality || 2), 0) / core.length : 2;
  if (o.bag && o.bag.formality <= 1 && (ctx.formality >= 3 || coreAvg >= 3.5)) { s -= 6; cons.push(`A ${short(o.bag)} is too casual for ${(ctx.occasionLabel || 'this occasion').toLowerCase()}.`); }
  if (cons.length === before) {
    if (extras.length && !loud.length) { s += 3; pros.push(`The ${extras.map(short).join(' and ')} ${extras.length > 1 ? 'finish' : 'finishes'} the look without crowding it.`); }
    else if (loud.length === 1) { s += 4; pros.push(`The ${short(loud[0])} adds a point of interest.`); }
  }

  // Fabric & texture: only judged when the fabric is known (never guessed from nothing).
  const tex = (i) => {
    const m = `${i.material || ''}`.toLowerCase();
    if (!m || (i.unverified || []).includes('material')) return null;
    if (/silk|satin|velvet|cashmere|sequin|lace|chiffon|organza/.test(m)) return 'luxe';
    if (/fleece|sweat|jersey|tech|mesh|spandex|polyester knit|nylon/.test(m)) return 'sport';
    if (/denim|canvas|leather|suede|corduroy|tweed|waxed/.test(m)) return 'rugged';
    if (/knit|wool|merino|cable|mohair|boucl/.test(m)) return 'knit';
    if (/linen|cotton|poplin|oxford|twill|chino|gabardine|crepe|suiting/.test(m)) return 'crisp';
    return null;
  };
  const worn = ['top', 'bottom', 'outer'].map((k) => o[k]).filter(Boolean);
  const textures = worn.map((i) => [i, tex(i)]).filter(([, t]) => t);
  const luxe = textures.find(([, t]) => t === 'luxe'), sport = textures.find(([, t]) => t === 'sport');
  if (luxe && sport) { s -= 12; cons.push(`The ${(luxe[0].material || '').toLowerCase()} ${NOUN[luxe[0].art] || 'piece'} and the ${(sport[0].material || '').toLowerCase()} ${NOUN[sport[0].art] || 'piece'} are fabrics from different worlds; one of them makes the other look accidental.`); }
  else if (luxe && textures.some(([, t]) => t === 'rugged' || t === 'knit')) { s += 4; pros.push(`Smooth ${(luxe[0].material || '').toLowerCase()} against a textured piece gives the outfit depth.`); }
  const denims = !isDress(o.top) ? [o.top, o.bottom].filter((i) => i && /denim/i.test(`${i.material || ''} ${i.art}`) && !(i.unverified || []).includes('material')) : [];
  if (denims.length === 2) {
    if (denims[0].colors?.[0]?.name === denims[1].colors?.[0]?.name) { s -= 8; cons.push('Denim on denim in the same wash looks like a uniform. Pick two clearly different washes.'); }
    else { s += 3; pros.push('Double denim in two different washes, done right.'); }
  }

  // Overall visual balance: where the eye lands (light vs dark, heavy vs light pieces)
  const upper = o.outer || o.top, lower = isDress(o.top) ? o.top : o.bottom;
  if (upper && lower && o.shoes) {
    const L = (i) => hexToHsl(i.colors[0].hex)[2];
    const heavyTop = (o.outer?.weight === 'heavy' || o.top?.fit === 'oversized') && lower.art === 'shorts';
    if (heavyTop) { s -= 8; cons.push(`Top-heavy: the bulky ${short(upper)} overwhelms the ${short(lower)}.`); }
    if (L(upper) < 0.3 && L(lower) > 0.75 && L(o.shoes) > 0.75) { s -= 4; cons.push('Dark on top and pale below. Darker shoes would ground the look.'); }
    else if (Math.abs(L(upper) - L(lower)) > 0.25 && Math.abs(L(o.shoes) - L(lower)) < 0.35) { s += 3; pros.push('Good light-and-dark balance from top to toe.'); }
  }
  return { score: clamp(s), pros, cons };
}

// ───────────────────────────────── Honest verdict
/**
 * A plain, honest verdict for any outfit, never flattering: what a frank friend with good taste would say.
 * @returns {{ label, tone: 'great'|'good'|'okay'|'no', line }}
 */
/** The score from which an outfit is recommended (and called a "Good outfit"). */
export const GOOD = 76;

export function verdictOf(c) {
  const worst = c.pillars.slice().sort((a, b) => a.score - b.score)[0];
  const firstCon = worst?.cons?.[0];
  if (c.dealBreakers?.length) return { label: "Doesn't work", tone: 'no', line: c.dealBreakers[0] };
  if (c.overall >= 88) return { label: 'Great look', tone: 'great', line: firstCon ? `Small note: ${firstCon.charAt(0).toLowerCase()}${firstCon.slice(1)}` : 'Nothing to fix.' };
  if (c.overall >= GOOD) return { label: 'Good outfit', tone: 'good', line: firstCon || 'Solid and easy to wear.' };
  if (c.overall >= 68) return { label: 'Okay, not exciting', tone: 'okay', line: firstCon ? `Wearable, but ${firstCon.charAt(0).toLowerCase()}${firstCon.slice(1)}` : 'Wearable, but it won\'t turn heads.' };
  return { label: 'Not recommended', tone: 'no', line: firstCon || 'Several things are working against each other here.' };
}

// ───────────────────────────────── Deal-breakers
// Things a stylist would never let you leave the house in. Each one names the pillar it belongs to.
const ATHLETIC = (i) => i && i.art === 'sneaker' && (i.style === 'sporty' || /running|trainer|athletic/i.test(i.name || ''));
export function dealBreakers(o, ctx) {
  const out = [];
  const add = (pillar, text) => out.push({ pillar, text });
  const core = ['top', 'bottom', 'outer', 'shoes'].map((k) => o[k]).filter(Boolean);
  if (!o.top || !o.shoes) return out;
  const sh = o.shoes;
  // weather
  if (ctx.rain >= 0.6 && (sh.art === 'sandal' || (sh.water || 1) <= 1)) add('fabric', `The ${short(sh)} won't survive the rain. Wear closed, water-resistant shoes.`);
  const diff = warmthOf(o) - warmthNeeded(ctx.tempC);
  if (diff < -2.5) add('fabric', `Far too light for ${ctx.tempC}°C. You'd be cold within minutes.`);
  if (diff > 3.5) add('fabric', `Far too warm for ${ctx.tempC}°C.`);
  if (sh.art === 'sandal' && ctx.tempC < 18 && !(sh.formality >= 4 && ctx.formality >= 4)) add('fabric', `Open ${short(sh)} at ${ctx.tempC}°C means cold feet.`);
  // shoes that cancel the outfit
  const dressy = core.filter((i) => i !== sh && (i.formality || 2) >= 3.5);
  if (ATHLETIC(sh) && (dressy.length || ctx.formality >= 3.5)) add('finish', `Athletic ${short(sh)} cancel out ${dressy.length ? `the ${short(dressy[0])}` : `a ${ctx.occasionLabel.toLowerCase()} look`}. Pick flats, loafers or boots.`);
  if (sh.formality >= 4.5 && ctx.formality <= 1.5) add('finish', `${short(sh).charAt(0).toUpperCase() + short(sh).slice(1)} are impractical for ${occ(ctx)}.`);
  // style families that never work together
  const fam = (i) => STYLE_FAMILY[i.style];
  const sporty = core.find((i) => (fam(i) === 'sport' && i !== sh) || (fam(i) === 'street' && ctx.formality >= 3.5 && (i.formality || 2) <= 2));
  const polished = core.find((i) => fam(i) === 'polished' && (i.formality || 2) >= 4);
  if (sporty && polished) add('finish', `The ${short(sporty)} and the ${short(polished)} belong to different worlds.`);
  // occasion
  const avg = core.reduce((a, i) => a + (i.formality || 2), 0) / core.length;
  const tooCasual = ['top', 'bottom'].map((k) => o[k]).find((i) => i && (i.formality || 2) <= ctx.formality - 2.4);
  if (avg - ctx.formality <= -1.5) add('occasion', `Much too casual for ${occ(ctx)}.`);
  else if (tooCasual) add('occasion', `The ${short(tooCasual)} ${plural(tooCasual) ? 'are' : 'is'} too casual for ${occ(ctx)}, even under a smarter layer.`);
  const tooDressy = ['top', 'bottom'].map((k) => o[k]).find((i) => i && ((i.formality || 2) >= ctx.formality + 2.5 || ((i.formality || 2) >= 5 && ctx.formality < 4)));
  if (avg - ctx.formality >= 2.2) add('occasion', `Much too dressy for ${occ(ctx)}.`);
  else if (tooDressy) add('occasion', `The ${short(tooDressy)} ${plural(tooDressy) ? 'are' : 'is'} far too dressy for ${occ(ctx)}.`);
  if (ctx.occasion === 'sports') {
    const lower = isDress(o.top) ? o.top : o.bottom;
    const canMove = lower && (lower.style === 'sporty' || lower.art === 'shorts' || /jogger|legging|track|sweat/i.test(lower.name || ''));
    if (!canMove) add('occasion', `The ${short(lower || o.top)} ${lower && plural(lower) ? 'are' : 'is'} hard to move in for sports.`);
    if (sh.art !== 'sneaker') add('fabric', `You'll want sneakers for sports, not ${short(sh)}.`);
  }
  return out;
}

// ───────────────────────────────── Public API
export const PILLARS = [
  { id: 'proportions', label: 'Proportions & Silhouette', weight: 0.17 },
  { id: 'fabric', label: 'Weather & Comfort', weight: 0.25 },
  { id: 'color', label: 'Color & Pattern', weight: 0.2 },
  { id: 'occasion', label: 'Occasion & Formality', weight: 0.2 },
  { id: 'finish', label: 'Style, Shoes & Accessories', weight: 0.18 },
];

export function critique(outfit, ctx) {
  const results = {
    proportions: proportions(outfit),
    fabric: fabricWeather(outfit, ctx),
    color: colorHarmony(outfit, ctx),
    occasion: occasionFit(outfit, ctx),
    finish: finish(outfit, ctx),
  };
  // Deal-breakers: serious flaws cap the score instead of being averaged away by good pillars.
  const breakers = dealBreakers(outfit, ctx);
  for (const b of breakers) {
    const r = results[b.pillar];
    r.score = clamp(r.score - 12);
    if (!r.cons.includes(b.text)) r.cons.unshift(b.text);
  }
  let overall = clamp(PILLARS.reduce((sum, p) => sum + results[p.id].score * p.weight, 0));
  if (breakers.length) overall = Math.min(overall, breakers.length > 1 ? 60 : 68);
  const items = pieces(outfit);
  const seasons = ['spring', 'summer', 'autumn', 'winter'].filter((s) => items.filter((i) => i.category !== 'accessory').every((i) => !i.seasons || i.seasons.includes(s)));
  const avgF = results.occasion.avg || 0;

  return {
    overall,
    dealBreakers: breakers.map((b) => b.text),
    pillars: PILLARS.map((p) => ({ ...p, ...results[p.id] })),
    seasons,
    weatherMeter: Math.max(1, Math.min(5, Math.round(results.fabric.score / 20))),
    formalityMeter: Math.max(1, Math.min(5, Math.round(avgF))),
    formalityLabel: FORMALITY_LABEL[Math.max(1, Math.min(5, Math.round(avgF)))] || '—',
    warmth: { have: Math.round(warmthOf(outfit) * 10) / 10, need: Math.round(warmthNeeded(ctx.tempC) * 10) / 10 },
  };
}

/** The single swap (or added/removed layer) from HER closet that improves the score most. */
export function suggestSwap(outfit, ctx, pool) {
  const base = critique(outfit, ctx).overall;
  let best = null;
  for (const slot of ['top', 'bottom', 'outer', 'shoes']) {
    if (slot === 'bottom' && isDress(outfit.top)) continue;
    const candidates = pool.filter((g) => slotOf(g) === slot && g.id !== outfit[slot]?.id && (slot !== 'top' || isDress(g) === isDress(outfit.top)));
    for (const c of candidates) {
      const score = critique({ ...outfit, [slot]: c }, ctx).overall;
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
  else if (!best.from) text = `Add your ${short(best.to)}.`;
  else text = `Swap the ${short(best.from)} for your ${short(best.to)}.`;
  return { ...best, gain, text };
}
