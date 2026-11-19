import { it } from 'vitest';
import { generateOutfits } from '../src/ai/generator.js';
import { buildContext } from '../src/ai/context.js';
import { OCCASIONS } from '../src/data/closet.js';
import { BOLD } from '../src/ai/quality.fixture.js';
it('perf', () => { const t = performance.now(); for (const o of ['everyday','work','date','church','party','vacation']) generateOutfits(BOLD, buildContext({occasion:o, weather:'warm'}, OCCASIONS)); console.log('6 contexts ms', Math.round(performance.now()-t)); });
