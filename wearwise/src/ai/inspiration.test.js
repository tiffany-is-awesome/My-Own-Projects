import { describe, it, expect } from 'vitest';
import { decomposeLook, matchLook, similarity } from './inspiration.js';
import { DEMO_CLOSET } from '../data/closet.js';

describe('inspiration: reading a described look (keyword matching, no AI)', () => {
  it('understands everyday words and color synonyms', () => {
    const items = decomposeLook('ivory blouse, wide grey slacks, tan loafers, maroon crossbody. Gold necklace');
    expect(items.map((i) => [i.art, i.color?.name])).toEqual([
      ['shirt', 'cream'], ['trousers', 'gray'], ['loafer', 'camel'], ['crossbody', 'burgundy'], ['necklace', 'mustard'],
    ]);
    expect(decomposeLook('sage cardigan + baby blue tank / white sneakers').map((i) => i.art)).toEqual(['cardigan', 'tee', 'sneaker']);
    expect(decomposeLook('black slip dress with heels')[0]).toMatchObject({ category: 'dress', art: 'dress' });
  });
});

describe('inspiration: matching to the closet', () => {
  it('separates exact, close and approximate matches and explains missing pieces', () => {
    const items = decomposeLook('black turtleneck, olive trousers, black chelsea boots, navy blazer, pink skirt');
    const m = matchLook(items, DEMO_CLOSET);
    const lvl = Object.fromEntries(m.matches.map((x) => [x.want.label, x.level]));
    expect(lvl['black turtleneck']).toBe('exact');
    expect(lvl['olive trousers']).toBe('exact');
    expect(['exact', 'close']).toContain(lvl['black chelsea boots']);
    const skirt = m.matches.find((x) => x.want.label === 'pink skirt') || m.missing.find((x) => x.label === 'pink skirt');
    expect(skirt.level === 'approximate' || !!skirt.reason).toBe(true);
    for (const x of m.matches) if (x.level !== 'exact') expect(x.why).toBeTruthy();
    expect(m.coverage).toBeGreaterThan(0);
    expect(m.coverage).toBeLessThanOrEqual(100);
  });
  it('says plainly when the closet has nothing of that kind', () => {
    const m = matchLook(decomposeLook('red sequin gown'), DEMO_CLOSET.filter((g) => g.category !== 'dress'));
    expect(m.missing[0].reason).toMatch(/No dresses/);
  });
  it('never matches across categories', () => {
    const want = decomposeLook('navy coat')[0];
    expect(similarity(want, DEMO_CLOSET.find((g) => g.category === 'top')).level).toBe(null);
  });
});
