import { describe, it, expect } from 'vitest';
import { critique, suggestSwap, isDress } from './critic.js';
import { parseContext, buildContext } from './context.js';
import { generateOutfits, styleWithThis, alternatives, familyLook, coordination, explain, missingForOutfit, isAvailable } from './generator.js';
import { decomposeLook, matchLook, SAMPLE_INSPIRATION } from './inspiration.js';
import { DEMO_CLOSET, OCCASIONS, slotOf } from '../data/closet.js';
import { DEMO_FAMILY } from '../data/family.js';
import { migrate, initialState } from '../store.jsx';

const closet = DEMO_CLOSET.map((g) => ({ ...g, ownerId: 'p-me' }));
const get = (id) => closet.find((g) => g.id === id);
const ids = (o) => Object.values(o).filter(Boolean).map((g) => g.id);
const ctxOf = (o) => buildContext(o, OCCASIONS);

describe('context', () => {
  it('reads temperature, rain and occasion from text', () => {
    const c = parseContext('Rainy Tuesday coffee meeting, 16°C');
    expect(c.tempC).toBe(16);
    expect(c.rain).toBeGreaterThan(0.5);
    expect(c.occasion).toBe('work');
  });
  it('converts Fahrenheit and finds cities', () => {
    const c = parseContext('Dinner in Paris, 50F');
    expect(c.tempC).toBe(10);
    expect(c.city).toBe('Paris');
    expect(c.occasion).toBe('date');
  });
  it('builds context from quick choices; exact temperature in text wins', () => {
    const c = ctxOf({ occasion: 'church', weather: 'rainy', style: 'classic', prefs: ['formal'] });
    expect(c.occasion).toBe('church');
    expect(c.rain).toBeGreaterThan(0.5);
    expect(c.formality).toBe(4.5);
    expect(ctxOf({ occasion: 'everyday', weather: 'warm', text: 'picnic, 19°C' }).tempC).toBe(19);
  });
});

describe('critic', () => {
  const rainy = parseContext('Rainy coffee meeting, 16°C');
  it('flags suede shoes in the rain', () => {
    const o = { top: get('t-oxford-blue'), bottom: get('b-olive-chino'), outer: get('o-trench'), shoes: get('s-suede-loafer') };
    expect(critique(o, rainy).pillars.find((p) => p.id === 'fabric').cons.join(' ')).toMatch(/suede/i);
  });
  it('flags volume on volume', () => {
    const o = { top: get('t-cream-knit'), bottom: get('b-olive-chino'), shoes: get('s-white-sneaker') };
    expect(critique(o, rainy).pillars.find((x) => x.id === 'proportions').cons.join(' ')).toMatch(/volume on volume/i);
  });
  it('flags overheating in a wool coat at 30°C', () => {
    const o = { top: get('t-black-turtle'), bottom: get('b-black-slacks'), outer: get('o-wool-coat'), shoes: get('s-black-boot') };
    expect(critique(o, parseContext('Beach café, 30°C')).pillars.find((p) => p.id === 'fabric').score).toBeLessThan(50);
  });
  it('treats a dress as a complete look and needs no bottom', () => {
    const c = critique({ top: get('d-navy-dress'), shoes: get('s-black-boot') }, ctxOf({ occasion: 'date', weather: 'cool' }));
    expect(c.pillars.find((p) => p.id === 'occasion').cons.join(' ')).not.toMatch(/add a bottom/i);
    expect(isDress(get('d-navy-dress'))).toBe(true);
  });
  it('checks pattern compatibility', () => {
    const stripes2 = { ...get('t-stripe-tee'), id: 'x', category: 'bottom', art: 'skirt' };
    const c = critique({ top: get('t-stripe-tee'), bottom: stripes2, shoes: get('s-white-sneaker') }, rainy);
    expect(c.pillars.find((p) => p.id === 'color').cons.join(' ')).toMatch(/stripe patterns/i);
  });
  it('checks style consistency and footwear', () => {
    const sporty = { ...get('o-puffer') };
    const c = critique({ top: get('d-navy-dress'), outer: sporty, shoes: get('s-black-boot') }, ctxOf({ occasion: 'wedding', weather: 'cool' }));
    expect(c.pillars.find((p) => p.id === 'finish').cons.join(' ')).toMatch(/mixed messages/i);
  });
  it('suggests a swap from her closet that raises the score', () => {
    const o = { top: get('t-oxford-blue'), bottom: get('b-olive-chino'), outer: get('o-trench'), shoes: get('s-suede-loafer') };
    const s = suggestSwap(o, rainy, closet);
    expect(s).not.toBeNull();
    expect(closet).toContain(s.to);
  });
});

describe('generator', () => {
  const ctx = ctxOf({ occasion: 'work', weather: 'rainy' });
  it('returns 3 distinct outfits using only her available clothes, each explained', () => {
    const { outfits, missing } = generateOutfits(closet, ctx);
    expect(missing).toEqual([]);
    expect(outfits).toHaveLength(3);
    const own = new Set(closet.map((g) => g.id));
    outfits.forEach((r) => { ids(r.outfit).forEach((id) => expect(own.has(id)).toBe(true)); expect(r.why.length).toBeGreaterThan(20); });
    expect(new Set(outfits.map((r) => r.outfit.top.id)).size).toBeGreaterThan(1);
  });
  it('never uses an item in the laundry', () => {
    const pool = closet.map((g) => (g.id === 's-black-boot' ? { ...g, status: 'laundry' } : g));
    const { outfits } = generateOutfits(pool, ctx);
    outfits.forEach((r) => expect(ids(r.outfit)).not.toContain('s-black-boot'));
    expect(isAvailable(pool.find((g) => g.id === 's-black-boot'))).toBe(false);
  });
  it('says what is missing for an empty or partial closet', () => {
    expect(missingForOutfit([])).toEqual(['a top and a bottom (or a dress)', 'shoes']);
    expect(generateOutfits([get('t-white-tee')], ctx).missing).toContain('shoes');
  });
  it('can build a look from a dress alone (no bottom)', () => {
    const pool = [get('d-navy-dress'), get('s-black-boot')];
    const { outfits } = generateOutfits(pool, ctxOf({ occasion: 'date', weather: 'cool' }));
    expect(outfits[0].outfit.top.id).toBe('d-navy-dress');
    expect(outfits[0].outfit.bottom).toBeNull();
  });
  it('keeps the anchor piece in every outfit', () => {
    const anchor = get('b-olive-chino');
    generateOutfits(closet, ctx, anchor).outfits.forEach((r) => expect(r.outfit.bottom.id).toBe(anchor.id));
  });
  it('dresses light at the beach', () => {
    const { outfits } = generateOutfits(closet, ctxOf({ occasion: 'vacation', weather: 'hot' }));
    expect(outfits[0].outfit.outer).toBeNull();
  });
});

describe('style me with this', () => {
  it('gives at least 3 distinct directions, all containing the garment', () => {
    const anchor = get('t-black-turtle');
    const { outfits } = styleWithThis(closet, anchor, ctxOf({ occasion: 'everyday', weather: 'cool' }));
    expect(outfits.length).toBeGreaterThanOrEqual(3);
    outfits.forEach((r) => expect(r.outfit.top.id).toBe(anchor.id));
    expect(new Set(outfits.map((r) => r.direction)).size).toBe(outfits.length);
  });
  it('refuses an unavailable garment', () => {
    const anchor = { ...get('t-black-turtle'), status: 'laundry' };
    const pool = closet.map((g) => (g.id === anchor.id ? anchor : g));
    expect(styleWithThis(pool, anchor, ctxOf({})).outfits).toHaveLength(0);
  });
});

describe('alternatives', () => {
  it('offers owned, complete alternatives', () => {
    const ctx = ctxOf({ occasion: 'work', weather: 'cool' });
    const o = { top: get('t-oxford-blue'), bottom: get('b-olive-chino'), shoes: get('s-white-sneaker') };
    const alts = alternatives(o, ctx, closet);
    const kinds = alts.map((a) => a.id);
    expect(kinds).toContain('shoes');
    expect(kinds).toContain('jacket');
    const own = new Set(closet.map((g) => g.id));
    alts.forEach((a) => ids(a.outfit).forEach((id) => expect(own.has(id)).toBe(true)));
  });
});

describe('family looks', () => {
  const me = { profile: { id: 'p-me', name: 'Me', kind: 'adult' }, pool: closet };
  const dadPool = DEMO_FAMILY.garments.filter((g) => g.ownerId === 'p-demo-dad');
  const kidPool = DEMO_FAMILY.garments.filter((g) => g.ownerId === 'p-demo-kid');
  const dad = { profile: DEMO_FAMILY.profiles[0], pool: dadPool };
  const kid = { profile: DEMO_FAMILY.profiles[1], pool: kidPool };
  it('dresses each member only from their own closet', () => {
    const r = familyLook([me, dad, kid], ctxOf({ occasion: 'church', weather: 'warm' }));
    expect(r.members).toHaveLength(3);
    r.members.forEach((m, i) => {
      const own = new Set([me, dad, kid][i].pool.map((g) => g.id));
      ids(m.outfit).forEach((id) => expect(own.has(id)).toBe(true));
    });
    expect(r.why.length).toBeGreaterThan(10);
  });
  it('reports which member is missing clothes', () => {
    const r = familyLook([me, { profile: { id: 'x', name: 'Leo', kind: 'child' }, pool: [] }], ctxOf({}));
    expect(r.missing[0].name).toBe('Leo');
  });
  it('rewards a shared accent color and penalizes identical tops', () => {
    const navyTop = DEMO_FAMILY.garments.find((g) => g.id === 'dad-navy-polo');
    const pinkDress = DEMO_FAMILY.garments.find((g) => g.id === 'kid-floral-dress');
    const shared = coordination([{ top: get('t-stripe-tee') }, { top: navyTop }]);
    const clash = coordination([{ top: get('t-rust-knit') }, { top: pinkDress }, { top: { ...pinkDress, colors: [{ name: 'green', hex: '#2F6B4A' }] } }]);
    expect(shared.score).toBeGreaterThan(clash.score);
    const twins = coordination([{ top: navyTop }, { top: { ...navyTop, id: 'y' } }]);
    expect(twins.cons.join(' ')).toMatch(/near-identical/);
  });
});

describe('explanations', () => {
  it('are plain language and mention the occasion', () => {
    const ctx = ctxOf({ occasion: 'church', weather: 'warm' });
    const o = { top: get('t-oxford-blue'), bottom: get('b-black-slacks'), shoes: get('s-suede-loafer') };
    const text = explain(o, critique(o, ctx), ctx);
    expect(text).toMatch(/church/i);
  });
});

describe('store migration (v1 → v2)', () => {
  it('starts new users with an empty closet', () => {
    expect(initialState().garments).toEqual([]);
  });
  it('flags old built-in sample items as demo, moves bags to the bag slot, drops never-owned basics', () => {
    const v1 = {
      onboarded: true,
      garments: [{ ...get('a-tote'), demo: undefined }, { ...get('t-white-tee'), demo: undefined }, { id: 'u-1', name: 'My shirt', category: 'top', art: 'shirt', colors: [{ name: 'white', hex: '#fff' }], uploaded: true }],
      outfits: [{ id: 'o-spring-1', slots: { top: 't-white-tee', bottom: 'basic-dark-jeans', accessory: 'a-tote' } }],
      draft: { slots: { top: 'u-1', accessory: 'a-tote' } },
    };
    const s = migrate(v1);
    expect(s.version).toBe(2);
    expect(s.garments.find((g) => g.id === 'a-tote').demo).toBe(true);
    expect(s.garments.find((g) => g.id === 'u-1').demo).toBe(false);
    expect(s.garments.every((g) => g.ownerId === 'p-me')).toBe(true);
    expect(s.outfits[0].slots.bag).toBe('a-tote');
    expect(s.outfits[0].slots.bottom).toBeNull();
    expect(s.draft.slots.bag).toBe('a-tote');
    expect(slotOf(get('a-tote'))).toBe('bag');
  });
});

describe('inspiration bridge', () => {
  it('decomposes and matches looks to the closet', () => {
    const items = decomposeLook(SAMPLE_INSPIRATION[0].text);
    expect(items.map((i) => i.category)).toEqual(['top', 'bottom', 'shoes', 'accessory']);
    const m = matchLook(items, closet);
    expect(m.coverage).toBe(100);
  });
});

describe('AI validation (rules engine checks the AI)', () => {
  it('rejects incomplete, impractical or foreign AI picks and tops up from the rules engine', async () => {
    const { styleWithAI } = await import('./stylist.js');
    const claudeMod = await import('./claude.js');
    // stand-in AI: one good outfit, one with suede in the rain, one using an item she doesn't own
    globalThis.window = { claude: undefined, top: undefined };
    const fake = { name: 'Gemini', images: true, json: async () => ({ outfits: [
      { top: 't-oxford-blue', bottom: 'b-olive-chino', outer: 'o-trench', shoes: 's-black-boot', bag: null, accessory: null, why: 'Rain-proof and polished.' },
      { top: 't-black-turtle', bottom: 'b-black-slacks', outer: null, shoes: 's-suede-loafer', bag: null, accessory: null, why: 'bad in rain' },
      { top: 'NOT-HERS', bottom: 'b-dark-denim', outer: null, shoes: 's-white-sneaker', bag: null, accessory: null, why: 'foreign' },
    ] }) };
    claudeMod.__setProviderForTests(fake);
    const ctx = ctxOf({ occasion: 'work', weather: 'rainy' });
    const r = await styleWithAI({ ctx, pool: closet });
    expect(r.outfits).toHaveLength(3);
    expect(r.outfits[0].source).toBe('ai');
    expect(r.outfits.filter((x) => x.source === 'ai')).toHaveLength(1);
    expect(r.note).toMatch(/replaced 2/);
    r.outfits.forEach((x) => expect(ids(x.outfit)).not.toContain('s-suede-loafer'));
    claudeMod.__setProviderForTests(undefined);
  });
});
