import { describe, it, expect } from 'vitest';
import { critique, suggestSwap } from './critic.js';
import { parseContext } from './context.js';
import { generateOutfits } from './generator.js';
import { decomposeLook, matchLook, SAMPLE_INSPIRATION } from './inspiration.js';
import { SAMPLE_CLOSET, BASICS } from '../data/closet.js';

const get = (id) => [...SAMPLE_CLOSET, ...BASICS].find((g) => g.id === id);
const pool = [...SAMPLE_CLOSET, ...BASICS];

describe('context parser', () => {
  it('reads temperature, rain and occasion', () => {
    const c = parseContext('Rainy Tuesday coffee meeting, 16°C');
    expect(c.tempC).toBe(16);
    expect(c.rain).toBeGreaterThan(0.5);
    expect(c.occasion).toBe('office'); // "meeting" wins over coffee → smart
  });
  it('converts Fahrenheit and finds cities', () => {
    const c = parseContext('Dinner in Paris, 50F');
    expect(c.tempC).toBe(10);
    expect(c.city).toBe('Paris');
    expect(c.occasion).toBe('dinner');
  });
});

describe('critic', () => {
  const rainy = parseContext('Rainy coffee meeting, 16°C');
  it('flags suede shoes in the rain', () => {
    const o = { top: get('t-oxford-blue'), bottom: get('b-olive-chino'), outer: get('o-trench'), shoes: get('s-suede-loafer') };
    const fabric = critique(o, rainy).pillars.find((p) => p.id === 'fabric');
    expect(fabric.cons.join(' ')).toMatch(/suede/i);
  });
  it('praises a water-repellent trench in the rain', () => {
    const o = { top: get('t-oxford-blue'), bottom: get('b-olive-chino'), outer: get('o-trench'), shoes: get('s-black-boot') };
    const fabric = critique(o, rainy).pillars.find((p) => p.id === 'fabric');
    expect(fabric.pros.join(' ')).toMatch(/water-repellent/i);
  });
  it('flags volume on volume', () => {
    const o = { top: get('t-cream-knit'), bottom: get('b-olive-chino'), shoes: get('s-white-sneaker') };
    const p = critique(o, rainy).pillars.find((x) => x.id === 'proportions');
    expect(p.cons.join(' ')).toMatch(/volume on volume/i);
  });
  it('flags overheating in a wool coat at 30°C', () => {
    const o = { top: get('t-black-turtle'), bottom: get('b-black-slacks'), outer: get('o-wool-coat'), shoes: get('s-black-boot') };
    const r = critique(o, parseContext('Beach café, 30°C'));
    expect(r.pillars.find((p) => p.id === 'fabric').score).toBeLessThan(50);
  });
  it('suggests a swap that raises the score', () => {
    const o = { top: get('t-oxford-blue'), bottom: get('b-olive-chino'), outer: get('o-trench'), shoes: get('s-suede-loafer') };
    const s = suggestSwap(o, rainy, pool);
    expect(s).not.toBeNull();
    expect(s.gain).toBeGreaterThan(0);
  });
});

describe('generator', () => {
  it('returns three diverse variations and respects the anchor', () => {
    const anchor = get('b-olive-chino');
    const res = generateOutfits(pool, parseContext('Rainy coffee meeting, 16°C'), anchor);
    expect(res).toHaveLength(3);
    res.forEach((r) => expect(r.outfit.bottom.id).toBe(anchor.id));
    const tops = new Set(res.map((r) => r.outfit.top.id));
    expect(tops.size).toBeGreaterThan(1);
  });
  it('dresses light at the beach', () => {
    const [classic] = generateOutfits(pool, parseContext('Sunny beach café, 30°C'));
    expect(classic.outfit.outer).toBeNull();
  });
});

describe('inspiration bridge', () => {
  it('decomposes and matches looks to the closet', () => {
    const items = decomposeLook(SAMPLE_INSPIRATION[0].text);
    expect(items.map((i) => i.category)).toEqual(['top', 'bottom', 'shoes', 'accessory']);
    const m = matchLook(items, SAMPLE_CLOSET);
    expect(m.coverage).toBe(75);
    expect(m.missing[0].art).toBe('crossbody');
  });
  it('matches the striped tee', () => {
    const m = matchLook(decomposeLook('navy stripe tee'), SAMPLE_CLOSET);
    expect(m.matches[0]?.garment.id).toBe('t-stripe-tee');
  });
});
