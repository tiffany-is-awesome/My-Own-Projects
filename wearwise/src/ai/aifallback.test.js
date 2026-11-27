// Every outfit shown from the AI path passes the same bar as the rules engine's own recommendations:
// score ≥ GOOD and no deal-breaker. The only exception is the rules engine's single labelled "closest option",
// shown exactly as the rules engine itself would show it when nothing good can be made.
import { describe, it, expect, vi, beforeEach } from 'vitest';

let aiReply = null; // what the pretend AI returns
vi.mock('./claude.js', () => ({
  getClaude: async () => ({ name: 'Test AI', json: async () => aiReply }),
  noteFailure: (e) => String(e?.message || e),
}));

const { styleWithAI } = await import('./stylist.js');
const { generateOutfits, GOOD } = await import('./generator.js');
const { buildContext } = await import('./context.js');
const { OCCASIONS, DEMO_CLOSET, slotOf } = await import('../data/closet.js');
const { SMALL } = await import('./quality.fixture.js');

const ctxOf = (o) => buildContext(o, OCCASIONS);
const passes = (x) => x.critique.overall >= GOOD && !x.critique.dealBreakers.length && !x.weak;
const ids = (pool, slot) => pool.filter((g) => slotOf(g) === slot).map((g) => g.id);

// deterministic pseudo-random
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const any = (list) => (list.length ? list[Math.floor(rnd() * list.length)] : null);
function randomOutfits(pool, n = 3) {
  return Array.from({ length: n }, () => ({ top: any(ids(pool, 'top')), bottom: rnd() < 0.85 ? any(ids(pool, 'bottom')) : null,
    outer: rnd() < 0.4 ? any(ids(pool, 'outer')) : null, shoes: rnd() < 0.9 ? any(ids(pool, 'shoes')) : null,
    bag: rnd() < 0.5 ? any(ids(pool, 'bag')) : null, accessory: rnd() < 0.4 ? any(ids(pool, 'accessory')) : 'not-a-real-id', why: 'test' }));
}

describe('AI path uses the same quality bar as the rules engine', () => {
  beforeEach(() => { aiReply = null; });

  it('300 random AI answers on the demo closet: every outfit shown passes the bar', async () => {
    const occasions = ['everyday', 'work', 'date', 'party', 'church', 'vacation', 'wedding'];
    const weathers = ['hot', 'warm', 'mild', 'cool', 'cold', 'rainy'];
    let shown = 0, aiShown = 0;
    for (let k = 0; k < 300; k++) {
      const ctx = ctxOf({ occasion: any(occasions), weather: any(weathers) });
      aiReply = { outfits: randomOutfits(DEMO_CLOSET) };
      const r = await styleWithAI({ ctx, pool: DEMO_CLOSET });
      const rules = generateOutfits(DEMO_CLOSET.filter((g) => g.owned !== false), ctx);
      const rulesHasGood = rules.outfits.some(passes);
      for (const x of r.outfits) {
        shown++; if (x.source === 'ai') aiShown++;
        if (rulesHasGood || x.source === 'ai') expect(passes(x), `${x.source} outfit "${x.name}" scored ${x.critique.overall}`).toBe(true);
      }
      expect(r.outfits.length).toBeLessThanOrEqual(3);
    }
    expect(shown).toBeGreaterThan(300);
    expect(aiShown).toBeGreaterThan(0); // some random AI picks are good enough and are used
  });

  it('a tiny closet with no good outfit: the AI path shows exactly what the rules engine shows (one labelled closest option)', async () => {
    const ctx = ctxOf({ occasion: 'wedding', weather: 'warm' });
    const rules = generateOutfits(SMALL, ctx);
    aiReply = { outfits: randomOutfits(SMALL) };
    const r = await styleWithAI({ ctx, pool: SMALL });
    if (!rules.outfits.some(passes)) {
      expect(r.outfits.map((x) => x.name)).toEqual(rules.outfits.map((x) => x.name));
      expect(r.note).toMatch(/closest option|can't make/);
    } else {
      r.outfits.forEach((x) => expect(passes(x)).toBe(true));
    }
  });

  it('a below-bar "closest option" is never added next to good AI outfits', async () => {
    const ctx = ctxOf({ occasion: 'everyday', weather: 'warm' });
    const good = generateOutfits(DEMO_CLOSET, ctx).outfits[0].outfit;
    aiReply = { outfits: [{ top: good.top.id, bottom: good.bottom?.id || null, outer: good.outer?.id || null, shoes: good.shoes.id, bag: null, accessory: null, why: 'ok' }] };
    const r = await styleWithAI({ ctx, pool: DEMO_CLOSET });
    r.outfits.forEach((x) => expect(passes(x)).toBe(true));
  });

  it('AI offline or failing: exactly the rules engine result', async () => {
    aiReply = 'not json';
    const ctx = ctxOf({ occasion: 'work', weather: 'mild' });
    const r = await styleWithAI({ ctx, pool: DEMO_CLOSET });
    expect(r.outfits.map((x) => x.name)).toEqual(generateOutfits(DEMO_CLOSET, ctx).outfits.map((x) => x.name));
  });
});
