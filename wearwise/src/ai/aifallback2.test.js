// Forced case: the AI found a passing outfit, but the rules engine only has its below-bar "closest option".
// The closest option must NOT be added next to the AI's good outfit.
import { describe, it, expect, vi } from 'vitest';

let aiReply = null;
vi.mock('./claude.js', () => ({ getClaude: async () => ({ name: 'Test AI', json: async () => aiReply }), noteFailure: (e) => String(e) }));
vi.mock('./generator.js', async (orig) => {
  const real = await orig();
  return { ...real, generateOutfits: (pool, ctx, anchor) => {
    const r = real.generateOutfits(pool, ctx, anchor);
    // pretend the rules engine found nothing good: only a below-bar closest option
    const weak = { ...r.outfits[r.outfits.length - 1], name: 'Closest option', critique: { ...r.outfits[0].critique, overall: 60 }, weak: false };
    return { ...r, outfits: [weak], note: "This closet can't make a really good outfit yet. Here's the closest option." };
  } };
});
const { styleWithAI } = await import('./stylist.js');
const real = await vi.importActual('./generator.js');
const { buildContext } = await import('./context.js');
const { OCCASIONS, DEMO_CLOSET } = await import('../data/closet.js');

describe('below-bar closest option and good AI outfits', () => {
  it('is not mixed in', async () => {
    const ctx = buildContext({ occasion: 'everyday', weather: 'warm' }, OCCASIONS);
    const good = real.generateOutfits(DEMO_CLOSET, ctx).outfits[0].outfit;
    aiReply = { outfits: [{ top: good.top.id, bottom: good.bottom?.id || null, outer: good.outer?.id || null, shoes: good.shoes.id, bag: null, accessory: null, why: 'ok' }] };
    const r = await styleWithAI({ ctx, pool: DEMO_CLOSET });
    expect(r.outfits.map((x) => x.name)).not.toContain('Closest option');
    r.outfits.forEach((x) => expect(x.critique.overall).toBeGreaterThanOrEqual(real.GOOD));
    expect(r.note).not.toMatch(/closest option/);
  });
});
