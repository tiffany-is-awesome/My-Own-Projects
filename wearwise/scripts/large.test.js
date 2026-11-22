// Large wardrobe: speed of outfit generation and size of the saved data (print-only check).
import { it } from 'vitest';
import { generateOutfits } from '../src/ai/generator.js';
import { versatility } from '../src/ai/insights.js';
import { buildContext } from '../src/ai/context.js';
import { OCCASIONS, DEMO_CLOSET } from '../src/data/closet.js';
import { BOLD } from '../src/ai/quality.fixture.js';
it('large wardrobe', () => {
  const base = [...DEMO_CLOSET, ...BOLD];
  const big = Array.from({ length: 6 }, (_, k) => base.map((g) => ({ ...g, id: g.id + '-' + k, name: g.name + ' ' + k }))).flat();
  const ctx = buildContext({ occasion: 'work', weather: 'cool' }, OCCASIONS);
  let t = performance.now(); const r = generateOutfits(big, ctx); const gen = performance.now() - t;
  t = performance.now(); versatility(big.slice(0, 120)); const ver = performance.now() - t;
  const photoBytes = 45000; // typical 640px WebP cut-out measured in the upload test (35–60 KB)
  console.log(`${big.length} pieces → 3 outfits in ${Math.round(gen)} ms (${r.outfits.length} shown); versatility for 120 pieces ${Math.round(ver)} ms; saved data with a photo per piece ≈ ${(big.length * (photoBytes * 1.37 + 600) / 1e6).toFixed(1)} MB`);
});
