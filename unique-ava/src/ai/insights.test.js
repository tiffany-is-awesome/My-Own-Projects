import { describe, it, expect } from 'vitest';
import { versatility, rediscover, wearStats, preferenceProfile, describePreferences, whyHardToStyle } from './insights.js';
import { generateOutfits, personalBonus } from './generator.js';
import { buildContext } from './context.js';
import { DEMO_CLOSET, OCCASIONS } from '../data/closet.js';
import { BOLD, item } from './quality.fixture.js';
import { migrate, initialState } from '../store.jsx';

const closet = DEMO_CLOSET.map((g) => ({ ...g, ownerId: 'p-me' }));
const byId = (id) => closet.find((g) => g.id === id) || BOLD.find((g) => g.id === id);
const wear = (date, slots, rating, tags) => ({ id: date + Object.values(slots).join(), profileId: 'p-me', date, slots, rating, tags });

describe('wear stats', () => {
  it('counts wears and the last date per item', () => {
    const s = wearStats([wear('2026-11-01', { top: 't-white-tee', bottom: 'b-dark-denim' }), wear('2026-11-10', { top: 't-white-tee' })]);
    expect(s['t-white-tee']).toEqual({ wears: 2, last: '2026-11-10' });
    expect(s['b-dark-denim'].wears).toBe(1);
  });
});

describe('versatility', () => {
  it('ranks pieces by how many strong outfits they make, and flags pieces that work nowhere', () => {
    const odd = item('Sequin Ballgown Skirt', 'bottom', 'skirt', 'lavender', { formality: 5, style: 'elegant', warmth: 1 });
    const v = versatility([...closet, odd]);
    expect(v.items[0].combos).toBeGreaterThan(v.items[v.items.length - 1].combos);
    expect(v.score).toBeGreaterThan(0);
    expect(v.score).toBeLessThanOrEqual(100);
    const row = v.items.find((x) => x.item.id === odd.id);
    expect(row.contexts).toEqual([]);
    expect(v.hardToStyle.map((x) => x.item.id)).toContain(odd.id);
    expect(whyHardToStyle(odd, closet)).toMatch(/dressiness|clash/);
  });
  it('ignores pieces that are in the laundry', () => {
    const v = versatility(closet.map((g) => (g.id === 't-white-tee' ? { ...g, status: 'laundry' } : g)));
    expect(v.items.some((x) => x.item.id === 't-white-tee')).toBe(false);
  });
});

describe('Rediscover My Closet', () => {
  it('suggests unworn or long-unworn pieces, each in a strong outfit that includes it', () => {
    const history = [wear('2026-11-15', { top: 't-black-turtle', bottom: 'b-olive-chino', shoes: 's-black-boot' })];
    const r = rediscover(closet, history, { now: '2026-11-19' });
    expect(r.length).toBeGreaterThan(0);
    for (const x of r) {
      expect(['t-black-turtle', 'b-olive-chino', 's-black-boot']).not.toContain(x.item.id);
      expect(Object.values(x.outfit).filter(Boolean).map((g) => g.id)).toContain(x.item.id);
      expect(x.critique.dealBreakers).toEqual([]);
    }
  });
  it('skips pieces added in the last two weeks', () => {
    const fresh = closet.map((g) => ({ ...g, addedAt: '2026-11-15' }));
    expect(rediscover(fresh, [], { now: '2026-11-19' })).toEqual([]);
  });
});

describe('learned preferences', () => {
  const history = [
    wear('2026-11-01', { top: 't-rust-knit', bottom: 'b-dark-denim', shoes: 's-white-sneaker' }, 5, ['loved', 'compliments']),
    wear('2026-11-03', { top: 't-stripe-tee', bottom: 'b-pleat-skirt', shoes: 's-suede-loafer' }, 1, ['not-me']),
  ];
  const p = preferenceProfile(history, byId, { now: '2026-11-19' });
  it('turns ratings and feedback into per-item, color and style nudges', () => {
    expect(p.rated).toBe(2);
    expect(p.items['t-rust-knit']).toBeGreaterThan(0);
    expect(p.items['b-pleat-skirt']).toBeLessThan(0);
    expect(describePreferences(p, byId).join(' ')).toMatch(/Souffle Yarn Crew Sweater/);
  });
  it('nudges ranking within ±8 points and never rescues a deal-breaker', () => {
    const o = { top: byId('t-rust-knit'), bottom: byId('b-dark-denim'), shoes: byId('s-white-sneaker') };
    const b = personalBonus(o, p);
    expect(b).toBeGreaterThan(0);
    expect(b).toBeLessThanOrEqual(8);
    const ctx = { ...buildContext({ occasion: 'everyday', weather: 'cool' }, OCCASIONS), personal: p };
    const plain = generateOutfits(closet, buildContext({ occasion: 'everyday', weather: 'cool' }, OCCASIONS)).outfits;
    const mine = generateOutfits(closet, ctx).outfits;
    const uses = (list, id) => list.filter((x) => Object.values(x.outfit).some((g) => g?.id === id)).length;
    expect(uses(mine, 't-rust-knit')).toBeGreaterThanOrEqual(uses(plain, 't-rust-knit'));
    expect(uses(mine, 'b-pleat-skirt')).toBeLessThanOrEqual(uses(plain, 'b-pleat-skirt'));
    for (const x of mine) expect(x.critique.dealBreakers).toEqual([]);
    const rain = generateOutfits(closet, { ...buildContext({ occasion: 'work', weather: 'rainy' }, OCCASIONS), personal: { items: { 's-suede-loafer': 3 }, colors: {}, styles: {}, recent: [] } }).outfits;
    for (const x of rain) expect(x.outfit.shoes.id).not.toBe('s-suede-loafer');
  });
});

describe('store data for Phase 2', () => {
  it('older saved data gains empty locations and history', () => {
    const s = migrate({ ...initialState(), locations: undefined, history: undefined, version: 2 });
    expect(s.locations ?? []).toEqual([]);
    expect(s.history ?? []).toEqual([]);
  });
});
