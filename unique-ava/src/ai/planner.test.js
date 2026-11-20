import { describe, it, expect } from 'vitest';
import { planTrip, daysBetween } from './planner.js';
import { buildContext } from './context.js';
import { DEMO_CLOSET, OCCASIONS } from '../data/closet.js';
import { SMALL } from './quality.fixture.js';

const ctx = (o) => buildContext(o, OCCASIONS);
const ids = (o) => Object.values(o).filter(Boolean).map((g) => g.id);

describe('trip planner', () => {
  it('lists every day between two dates (max 31)', () => {
    expect(daysBetween('2026-12-20', '2026-12-24')).toEqual(['2026-12-20', '2026-12-21', '2026-12-22', '2026-12-23', '2026-12-24']);
    expect(daysBetween('2026-01-01', '2026-12-31')).toHaveLength(31);
  });
  it('plans a different strong outfit each day, re-using pieces for a light suitcase', () => {
    const dates = daysBetween('2026-12-20', '2026-12-24');
    const r = planTrip(DEMO_CLOSET, ctx({ occasion: 'vacation', weather: 'warm' }), dates);
    expect(r.days).toHaveLength(5);
    const keys = r.days.map((d) => ['top', 'bottom', 'outer', 'shoes'].map((k) => d.outfit[k]?.id || '-').join('|'));
    expect(new Set(keys).size).toBe(5);
    for (let i = 1; i < r.days.length; i++) expect(r.days[i].outfit.top.id).not.toBe(r.days[i - 1].outfit.top.id);
    for (const d of r.days) { expect(d.critique.dealBreakers).toEqual([]); expect(d.critique.overall).toBeGreaterThanOrEqual(72); }
    const pieces = new Set(r.days.flatMap((d) => ids(d.outfit)));
    expect(r.packing.length).toBe(pieces.size);
    expect(r.packing.length).toBeLessThan(5 * 4); // fewer pieces than wearing everything once
    expect(r.packing.some((p) => p.days > 1)).toBe(true);
  });
  it('rainy trips never pack suede or sandals as the only shoes', () => {
    const r = planTrip(DEMO_CLOSET, ctx({ occasion: 'everyday', weather: 'rainy' }), daysBetween('2026-12-01', '2026-12-03'));
    for (const d of r.days) expect(['s-suede-loafer', 's-sandal']).not.toContain(d.outfit.shoes.id);
  });
  it('is honest when the closet is too small', () => {
    const tiny = [SMALL[1], SMALL[3], SMALL[5]]; // one top, one bottom, one pair of shoes
    const r = planTrip(tiny, ctx({ occasion: 'everyday', weather: 'cool' }), daysBetween('2026-12-01', '2026-12-03'));
    expect(r.note).toMatch(/repeat|strong/);
    const none = planTrip([], ctx({ occasion: 'everyday', weather: 'warm' }), ['2026-12-01']);
    expect(none.missing.length).toBeGreaterThan(0);
  });
});
