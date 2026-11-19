// Run with: npx vitest run scripts/quality.test.js  (prints, asserts nothing)
import { it } from 'vitest';
import { generateOutfits } from '../src/ai/generator.js';
import { buildContext } from '../src/ai/context.js';
import { OCCASIONS } from '../src/data/closet.js';
import { BOLD, SMALL } from '../src/ai/quality.fixture.js';
const c = (o) => buildContext(o, OCCASIONS);
const n = (o) => ['top','bottom','outer','shoes','bag','accessory'].map(k => o[k]?.name || '-').join(' | ');
it('print', () => {
  const cases = [
    ['BOLD', BOLD, {occasion:'wedding',weather:'warm'}],
    ['BOLD', BOLD, {occasion:'work',weather:'cool'}],
    ['BOLD', BOLD, {occasion:'date',weather:'warm',style:'elegant'}],
    ['BOLD', BOLD, {occasion:'everyday',weather:'warm',prefs:['colorful']}],
    ['BOLD', BOLD, {occasion:'sports',weather:'warm'}],
    ['BOLD', BOLD, {occasion:'church',weather:'cool'}],
    ['BOLD', BOLD, {occasion:'everyday',weather:'rainy'}],
    ['BOLD', BOLD, {occasion:'party',weather:'cold',style:'edgy'}],
    ['BOLD', BOLD, {occasion:'school',weather:'hot'}],
    ['SMALL', SMALL, {occasion:'wedding',weather:'warm'}],
    ['SMALL', SMALL, {occasion:'vacation',weather:'hot'}],
  ];
  for (const [nm, pool, q] of cases) {
    const ctx = c(q); console.log(`\n## ${nm} · ${ctx.prompt}`);
    const r = generateOutfits(pool, ctx);
    if (r.missing.length) console.log('missing', r.missing);
    r.outfits.forEach(x => console.log(x.critique.overall, '::', n(x.outfit), '\n    watch:', x.critique.pillars.flatMap(p=>p.cons).slice(0,2).join(' / ')));
  }
});
