// Outfit-quality regression tests: real-looking, colorful closets and hard occasions.
import { describe, it, expect } from 'vitest';
import { critique } from './critic.js';
import { buildContext } from './context.js';
import { generateOutfits } from './generator.js';
import { OCCASIONS } from '../data/closet.js';
import { BOLD, SMALL, item } from './quality.fixture.js';

const ctxOf = (o) => buildContext(o, OCCASIONS);
const by = (pool, name) => pool.find((g) => g.name === name);
const names = (o) => Object.values(o).filter(Boolean).map((g) => g.name);

describe('deal-breakers cap the score', () => {
  it('a cocktail dress with running shoes can never look like a good outfit', () => {
    const o = { top: by(BOLD, 'Black Cocktail Dress'), shoes: by(BOLD, 'Running Shoes') };
    const c = critique(o, ctxOf({ occasion: 'church', weather: 'warm' }));
    expect(c.overall).toBeLessThanOrEqual(68);
    expect(c.dealBreakers.join(' ')).toMatch(/Athletic/);
  });
  it('heels in the rain and a graphic tee at work are flagged', () => {
    const rain = critique({ top: by(BOLD, 'White Silk Blouse'), bottom: by(BOLD, 'Black Tailored Trousers'), shoes: by(BOLD, 'Red Strappy Heels') }, ctxOf({ occasion: 'work', weather: 'rainy' }));
    expect(rain.dealBreakers.length).toBeGreaterThan(0);
    const tee = critique({ top: by(BOLD, 'Black Graphic Tee'), bottom: by(BOLD, 'Black Tailored Trousers'), outer: by(BOLD, 'Camel Long Coat'), shoes: by(BOLD, 'Nude Ballet Flats') }, ctxOf({ occasion: 'work', weather: 'cool' }));
    expect(tee.dealBreakers.join(' ')).toMatch(/too casual for work/);
  });
  it('does not crash on items without a material', () => {
    const o = { top: item('Tee', 'top', 'tee', 'white'), bottom: item('Jeans', 'bottom', 'jeans', 'denim blue'), shoes: item('Flats', 'shoes', 'loafer', 'black', { water: 1 }) };
    expect(() => critique(o, ctxOf({ occasion: 'everyday', weather: 'rainy' }))).not.toThrow();
  });
});

describe('recommendations from a bold, patterned closet', () => {
  const run = (q) => generateOutfits(BOLD, ctxOf(q)).outfits;
  it('church and work never pair dressy pieces with athletic or chunky sneakers', () => {
    for (const occasion of ['church', 'work', 'wedding']) {
      for (const o of run({ occasion, weather: 'cool' })) {
        expect(names(o.outfit)).not.toContain('Running Shoes');
        expect(o.critique.dealBreakers).toEqual([]);
      }
    }
  });
  it('sports outfits use clothes you can move in, with sneakers', () => {
    const out = run({ occasion: 'sports', weather: 'warm' });
    expect(out.length).toBeGreaterThan(0);
    for (const o of out) {
      expect(o.outfit.shoes.art).toBe('sneaker');
      expect(['Grey Joggers']).toContain(o.outfit.bottom?.name);
    }
  });
  it('rain outfits never use sandals, heels or suede, and the straw tote stays home', () => {
    for (const o of run({ occasion: 'everyday', weather: 'rainy' })) {
      expect(o.outfit.shoes.art).not.toBe('sandal');
      expect((o.outfit.shoes.water || 1)).toBeGreaterThan(1);
    }
  });
  it('a wedding gets dressy shoes and a dressy bag', () => {
    for (const o of run({ occasion: 'wedding', weather: 'warm' })) {
      expect(o.outfit.shoes.formality).toBeGreaterThanOrEqual(3);
      if (o.outfit.bag) expect(o.outfit.bag.formality).toBeGreaterThan(1);
    }
  });
  it('outfits are sorted best first', () => {
    const out = run({ occasion: 'everyday', weather: 'warm' });
    const s = out.map((o) => o.critique.overall);
    expect(s).toEqual([...s].sort((a, b) => b - a));
  });
});

describe('honesty when the closet is too small', () => {
  it('returns fewer outfits with a note instead of padding with bad ones', () => {
    const r = generateOutfits(SMALL, ctxOf({ occasion: 'wedding', weather: 'warm' }));
    expect(r.outfits.length).toBeLessThan(3);
    expect(r.note).toMatch(/strong outfit|closest option/);
    for (const o of r.outfits) expect(names(o.outfit)).not.toContain('Flip Flops');
  });
});

describe('honest verdicts', () => {
  it('says plainly when an outfit does not work, and is only "great" when it really scores high', async () => {
    const { verdictOf } = await import('./critic.js');
    const bad = critique({ top: by(BOLD, 'Black Cocktail Dress'), shoes: by(BOLD, 'Running Shoes') }, ctxOf({ occasion: 'church', weather: 'warm' }));
    expect(verdictOf(bad)).toMatchObject({ label: "Doesn't work", tone: 'no' });
    expect(verdictOf(bad).line).toMatch(/Athletic/);
    const ok = generateOutfits(BOLD, ctxOf({ occasion: 'everyday', weather: 'warm' })).outfits[0];
    const v = verdictOf(ok.critique);
    expect(['great', 'good']).toContain(v.tone);
    if (v.tone === 'great') expect(ok.critique.overall).toBeGreaterThanOrEqual(88);
    const meh = { ...ok.critique, overall: 70, dealBreakers: [] };
    expect(verdictOf(meh).label).toMatch(/Okay/);
  });
});

describe('fabric, texture and contrast (only when the fabric is known)', () => {
  const ctx = ctxOf({ occasion: 'party', weather: 'warm' });
  const fin = (o) => critique(o, ctx).pillars.find((p) => p.id === 'finish');
  const silk = item('Silk Cami', 'top', 'tee', 'black', { material: 'Silk satin', formality: 3.5 });
  const fleece = item('Fleece Joggers', 'bottom', 'trousers', 'gray', { material: 'Cotton fleece', style: 'sporty', formality: 1 });
  const jeans = item('Dark Jeans', 'bottom', 'jeans', 'denim blue', { material: 'Denim' });
  const flats = item('Black Flats', 'shoes', 'loafer', 'black', { formality: 3, material: 'Leather' });
  it('silky + sporty fleece is flagged', () => {
    expect(fin({ top: silk, bottom: fleece, shoes: flats }).cons.join(' ')).toMatch(/different worlds/);
  });
  it('silk with denim is a texture win', () => {
    expect(fin({ top: silk, bottom: jeans, shoes: flats }).pros.join(' ')).toMatch(/depth/);
  });
  it('same-wash double denim is flagged, different washes are praised', () => {
    const shirt = item('Denim Shirt', 'top', 'shirt', 'denim blue', { material: 'Denim' });
    expect(fin({ top: shirt, bottom: jeans, shoes: flats }).cons.join(' ')).toMatch(/uniform/);
    const light = item('Light Denim Shirt', 'top', 'shirt', 'light blue', { material: 'Denim' });
    expect(fin({ top: light, bottom: jeans, shoes: flats }).pros.join(' ')).toMatch(/different washes/);
  });
  it('a guessed (unchecked) fabric is never judged', () => {
    const guess = { ...silk, unverified: ['material'] };
    const f = fin({ top: guess, bottom: fleece, shoes: flats });
    expect(f.cons.join(' ')).not.toMatch(/different worlds/);
  });
});

describe('quality bar', () => {
  it('shows only good outfits; a small closet gets fewer, with an honest note', async () => {
    const { GOOD } = await import('./generator.js');
    const r = generateOutfits(SMALL, ctxOf({ occasion: 'work', weather: 'cool' }));
    expect(r.outfits.length).toBeLessThan(3);
    for (const o of r.outfits) expect(o.critique.overall >= GOOD || r.outfits.length === 1).toBe(true);
    expect(r.note).toMatch(/good outfit|closest option/);
    const big = generateOutfits(BOLD, ctxOf({ occasion: 'everyday', weather: 'warm' }));
    expect(big.outfits).toHaveLength(3);
    for (const o of big.outfits) expect(o.critique.overall).toBeGreaterThanOrEqual(GOOD);
  });
});
