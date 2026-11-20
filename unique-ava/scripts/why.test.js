import { it } from 'vitest';
import { generateOutfits } from '../src/ai/generator.js';
import { buildContext } from '../src/ai/context.js';
import { OCCASIONS, DEMO_CLOSET } from '../src/data/closet.js';
it('why', () => { for (const q of [{occasion:'everyday',weather:'warm'},{occasion:'work',weather:'rainy'},{occasion:'date',weather:'cool'}]) { const ctx=buildContext(q,OCCASIONS); for (const x of generateOutfits(DEMO_CLOSET, ctx).outfits) console.log('\n#', x.name, '·', x.vibe, '\n ', x.why); } });
